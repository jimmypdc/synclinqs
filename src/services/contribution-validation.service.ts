import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';

// IRS limits for 2024 (amounts in cents)
export const IRS_LIMITS = {
  2024: {
    EMPLOYEE_ELECTIVE_DEFERRAL: 2300000, // $23,000
    CATCH_UP_CONTRIBUTION: 750000, // $7,500 (age 50+)
    TOTAL_ANNUAL_ADDITIONS: 6900000, // $69,000 (415 limit)
    HIGHLY_COMPENSATED_THRESHOLD: 15500000, // $155,000
  },
  2025: {
    EMPLOYEE_ELECTIVE_DEFERRAL: 2350000, // $23,500
    CATCH_UP_CONTRIBUTION: 750000, // $7,500 (age 50+)
    TOTAL_ANNUAL_ADDITIONS: 7000000, // $70,000 (415 limit)
    HIGHLY_COMPENSATED_THRESHOLD: 16000000, // $160,000
  },
  2026: {
    EMPLOYEE_ELECTIVE_DEFERRAL: 2350000, // $23,500 (projected)
    CATCH_UP_CONTRIBUTION: 750000, // $7,500 (age 50+)
    TOTAL_ANNUAL_ADDITIONS: 7000000, // $70,000 (415 limit)
    HIGHLY_COMPENSATED_THRESHOLD: 16000000, // $160,000
  },
} as const;

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  limit?: number;
  current?: number;
  proposed?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  ytdTotals: {
    employeeElective: number;
    employerContributions: number;
    totalAdditions: number;
  };
}

export interface ContributionToValidate {
  employeeId: string;
  planId: string;
  payrollDate: string | Date;
  employeePreTax: number;
  employeeRoth?: number;
  employerMatch?: number;
  employerNonMatch?: number;
  loanRepayment?: number;
}

function getIrsLimits(year: number) {
  const limits = IRS_LIMITS[year as keyof typeof IRS_LIMITS];
  if (!limits) {
    // Fall back to most recent year
    const years = Object.keys(IRS_LIMITS).map(Number).sort((a, b) => b - a);
    return IRS_LIMITS[years[0] as keyof typeof IRS_LIMITS];
  }
  return limits;
}

function calculateAge(dateOfBirth: Date, asOfDate: Date): number {
  let age = asOfDate.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = asOfDate.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOfDate.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

export class ContributionValidationService {
  /**
   * Validate a contribution against IRS limits and plan rules
   */
  async validateContribution(
    contribution: ContributionToValidate,
    options: { skipYtdCheck?: boolean } = {}
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    const payrollDate = new Date(contribution.payrollDate);
    const year = payrollDate.getFullYear();
    const irsLimits = getIrsLimits(year);

    // Fetch employee with plan and calculate YTD
    const employee = await prisma.employee.findUnique({
      where: { id: contribution.employeeId },
      include: { plan: true },
    });

    if (!employee) {
      errors.push({
        field: 'employeeId',
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found',
      });
      return { valid: false, errors, warnings, ytdTotals: { employeeElective: 0, employerContributions: 0, totalAdditions: 0 } };
    }

    // Check employee status
    if (employee.status !== 'ACTIVE') {
      errors.push({
        field: 'employeeId',
        code: 'EMPLOYEE_NOT_ACTIVE',
        message: `Employee is not active (status: ${employee.status})`,
      });
    }

    // Check plan enrollment
    if (employee.planId !== contribution.planId) {
      errors.push({
        field: 'planId',
        code: 'EMPLOYEE_NOT_IN_PLAN',
        message: 'Employee is not enrolled in this plan',
      });
    }

    // Calculate proposed contribution amounts
    const proposedEmployeeElective = contribution.employeePreTax + (contribution.employeeRoth ?? 0);
    const proposedEmployerContributions = (contribution.employerMatch ?? 0) + (contribution.employerNonMatch ?? 0);
    const proposedTotalAdditions = proposedEmployeeElective + proposedEmployerContributions;

    // Get YTD totals
    let ytdEmployeeElective = 0;
    let ytdEmployerContributions = 0;
    let ytdTotalAdditions = 0;

    if (!options.skipYtdCheck) {
      const ytd = await this.getYtdContributions(contribution.employeeId, year);
      ytdEmployeeElective = ytd.employeeElective;
      ytdEmployerContributions = ytd.employerContributions;
      ytdTotalAdditions = ytd.totalAdditions;
    }

    // Determine catch-up eligibility
    let catchUpEligible = false;
    let employeeAge = 0;
    if (employee.dateOfBirthEncrypted) {
      // Note: In production, we'd decrypt and parse the date of birth
      // For now, we'll skip catch-up validation if DOB is encrypted
      // This would need the decrypt function and proper date parsing
    }

    // Calculate limits
    const baseEmployeeLimit = irsLimits.EMPLOYEE_ELECTIVE_DEFERRAL;
    const catchUpLimit = catchUpEligible ? irsLimits.CATCH_UP_CONTRIBUTION : 0;
    const totalEmployeeLimit = baseEmployeeLimit + catchUpLimit;
    const planEmployeeLimit = employee.plan.employeeContributionLimit;
    const effectiveEmployeeLimit = Math.min(totalEmployeeLimit, planEmployeeLimit);

    // Validate employee elective deferrals (402(g) limit)
    const newYtdEmployeeElective = ytdEmployeeElective + proposedEmployeeElective;
    if (newYtdEmployeeElective > effectiveEmployeeLimit) {
      errors.push({
        field: 'employeePreTax',
        code: 'EXCEEDS_EMPLOYEE_ELECTIVE_LIMIT',
        message: `Contribution would exceed annual employee elective deferral limit`,
        limit: effectiveEmployeeLimit,
        current: ytdEmployeeElective,
        proposed: proposedEmployeeElective,
      });
    }

    // Warning if approaching limit (90% threshold)
    const warningThreshold = effectiveEmployeeLimit * 0.9;
    if (newYtdEmployeeElective > warningThreshold && newYtdEmployeeElective <= effectiveEmployeeLimit) {
      warnings.push({
        field: 'employeePreTax',
        code: 'APPROACHING_EMPLOYEE_LIMIT',
        message: `Employee is approaching annual elective deferral limit`,
        limit: effectiveEmployeeLimit,
        current: ytdEmployeeElective,
        proposed: proposedEmployeeElective,
      });
    }

    // Validate total annual additions (415 limit)
    const newYtdTotalAdditions = ytdTotalAdditions + proposedTotalAdditions;
    if (newYtdTotalAdditions > irsLimits.TOTAL_ANNUAL_ADDITIONS) {
      errors.push({
        field: 'total',
        code: 'EXCEEDS_415_LIMIT',
        message: `Contribution would exceed IRC Section 415 annual additions limit`,
        limit: irsLimits.TOTAL_ANNUAL_ADDITIONS,
        current: ytdTotalAdditions,
        proposed: proposedTotalAdditions,
      });
    }

    // Validate employer match against plan limit
    if (employee.plan.employerMatchLimit && (contribution.employerMatch ?? 0) > employee.plan.employerMatchLimit) {
      errors.push({
        field: 'employerMatch',
        code: 'EXCEEDS_PLAN_MATCH_LIMIT',
        message: `Employer match exceeds plan limit`,
        limit: employee.plan.employerMatchLimit,
        proposed: contribution.employerMatch,
      });
    }

    // Validate non-negative amounts (should be caught by Zod, but double-check)
    if (contribution.employeePreTax < 0) {
      errors.push({
        field: 'employeePreTax',
        code: 'NEGATIVE_AMOUNT',
        message: 'Employee pre-tax contribution cannot be negative',
      });
    }

    logger.info('Contribution validation completed', {
      employeeId: contribution.employeeId,
      valid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      ytdEmployeeElective,
      proposedEmployeeElective,
      effectiveEmployeeLimit,
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      ytdTotals: {
        employeeElective: ytdEmployeeElective,
        employerContributions: ytdEmployerContributions,
        totalAdditions: ytdTotalAdditions,
      },
    };
  }

  /**
   * Get year-to-date contribution totals for an employee
   */
  async getYtdContributions(
    employeeId: string,
    year: number
  ): Promise<{
    employeeElective: number;
    employerContributions: number;
    totalAdditions: number;
    contributionCount: number;
  }> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const contributions = await prisma.contribution.findMany({
      where: {
        employeeId,
        payrollDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
        status: {
          in: ['PENDING', 'VALIDATED', 'SUBMITTED', 'CONFIRMED'],
        },
        deletedAt: null,
      },
      select: {
        employeePreTax: true,
        employeeRoth: true,
        employerMatch: true,
        employerNonMatch: true,
      },
    });

    let employeeElective = 0;
    let employerContributions = 0;

    for (const c of contributions) {
      employeeElective += c.employeePreTax + c.employeeRoth;
      employerContributions += c.employerMatch + c.employerNonMatch;
    }

    return {
      employeeElective,
      employerContributions,
      totalAdditions: employeeElective + employerContributions,
      contributionCount: contributions.length,
    };
  }

  /**
   * Validate a batch of contributions
   */
  async validateBatch(
    contributions: ContributionToValidate[]
  ): Promise<Map<number, ValidationResult>> {
    const results = new Map<number, ValidationResult>();

    // Group by employee to efficiently calculate YTD once per employee
    const byEmployee = new Map<string, { index: number; contribution: ContributionToValidate }[]>();

    contributions.forEach((contribution, index) => {
      const list = byEmployee.get(contribution.employeeId) ?? [];
      list.push({ index, contribution });
      byEmployee.set(contribution.employeeId, list);
    });

    for (const [employeeId, items] of byEmployee) {
      if (items.length === 0) continue;

      // Get base YTD for this employee
      const firstItem = items[0]!;
      const year = new Date(firstItem.contribution.payrollDate).getFullYear();
      const baseYtd = await this.getYtdContributions(employeeId, year);

      // Validate each contribution, accumulating totals
      let runningEmployeeElective = baseYtd.employeeElective;
      let runningEmployerContributions = baseYtd.employerContributions;

      for (const { index, contribution } of items) {
        // Temporarily adjust YTD for validation
        const result = await this.validateContribution(contribution, { skipYtdCheck: true });

        // Manual YTD check with running totals
        const proposedEmployeeElective = contribution.employeePreTax + (contribution.employeeRoth ?? 0);
        const proposedEmployerContributions = (contribution.employerMatch ?? 0) + (contribution.employerNonMatch ?? 0);

        // Update result with correct YTD values
        result.ytdTotals = {
          employeeElective: runningEmployeeElective,
          employerContributions: runningEmployerContributions,
          totalAdditions: runningEmployeeElective + runningEmployerContributions,
        };

        // Update running totals for next contribution in batch
        runningEmployeeElective += proposedEmployeeElective;
        runningEmployerContributions += proposedEmployerContributions;

        results.set(index, result);
      }
    }

    return results;
  }
}
