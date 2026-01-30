import { ContributionValidationService, IRS_LIMITS } from '../../../src/services/contribution-validation.service';
import { prisma } from '../../../src/lib/prisma';

// Mock dependencies
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    employee: {
      findUnique: jest.fn(),
    },
    contribution: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('ContributionValidationService', () => {
  let service: ContributionValidationService;

  const mockEmployee = {
    id: 'emp-123',
    organizationId: 'org-456',
    planId: 'plan-789',
    employeeNumber: 'EMP001',
    status: 'ACTIVE',
    dateOfBirthEncrypted: null,
    plan: {
      id: 'plan-789',
      employeeContributionLimit: 2300000, // $23,000
      employerMatchLimit: 690000, // $6,900
    },
  };

  const baseContribution = {
    employeeId: 'emp-123',
    planId: 'plan-789',
    payrollDate: '2024-06-15',
    employeePreTax: 50000, // $500
    employeeRoth: 0,
    employerMatch: 25000, // $250
    employerNonMatch: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContributionValidationService();
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(mockEmployee);
    (prisma.contribution.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('validateContribution', () => {
    it('should return valid for a contribution within limits', async () => {
      const result = await service.validateContribution(baseContribution);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error if employee not found', async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateContribution(baseContribution);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'EMPLOYEE_NOT_FOUND',
        })
      );
    });

    it('should return error if employee is not active', async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
        ...mockEmployee,
        status: 'TERMINATED',
      });

      const result = await service.validateContribution(baseContribution);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'EMPLOYEE_NOT_ACTIVE',
        })
      );
    });

    it('should return error if employee not in plan', async () => {
      const result = await service.validateContribution({
        ...baseContribution,
        planId: 'different-plan',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'EMPLOYEE_NOT_IN_PLAN',
        })
      );
    });

    it('should return error if contribution exceeds annual limit', async () => {
      // Simulate existing YTD contributions near the limit
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([
        {
          employeePreTax: 2200000, // $22,000 YTD
          employeeRoth: 0,
          employerMatch: 100000,
          employerNonMatch: 0,
        },
      ]);

      const result = await service.validateContribution({
        ...baseContribution,
        employeePreTax: 200000, // $2,000 - would exceed $23,000 limit
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'EXCEEDS_EMPLOYEE_ELECTIVE_LIMIT',
        })
      );
    });

    it('should return warning when approaching limit', async () => {
      // Simulate YTD at 85% of limit
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([
        {
          employeePreTax: 1955000, // $19,550 YTD (85%)
          employeeRoth: 0,
          employerMatch: 100000,
          employerNonMatch: 0,
        },
      ]);

      const result = await service.validateContribution({
        ...baseContribution,
        employeePreTax: 150000, // $1,500 - brings to 91.5%
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'APPROACHING_EMPLOYEE_LIMIT',
        })
      );
    });

    it('should return error if employer match exceeds plan limit', async () => {
      const result = await service.validateContribution({
        ...baseContribution,
        employerMatch: 700000, // $7,000 - exceeds $6,900 plan limit
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'EXCEEDS_PLAN_MATCH_LIMIT',
        })
      );
    });

    it('should return error if exceeds 415 limit', async () => {
      // Simulate YTD near 415 limit
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([
        {
          employeePreTax: 2300000, // $23,000
          employeeRoth: 0,
          employerMatch: 4500000, // $45,000
          employerNonMatch: 0,
        },
      ]);

      const result = await service.validateContribution({
        ...baseContribution,
        employeePreTax: 0,
        employerMatch: 200000, // $2,000 - would exceed $69,000 415 limit
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'EXCEEDS_415_LIMIT',
        })
      );
    });
  });

  describe('getYtdContributions', () => {
    it('should calculate YTD totals correctly', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([
        {
          employeePreTax: 100000,
          employeeRoth: 50000,
          employerMatch: 75000,
          employerNonMatch: 25000,
        },
        {
          employeePreTax: 100000,
          employeeRoth: 50000,
          employerMatch: 75000,
          employerNonMatch: 25000,
        },
      ]);

      const result = await service.getYtdContributions('emp-123', 2024);

      expect(result.employeeElective).toBe(300000); // 2 * (100000 + 50000)
      expect(result.employerContributions).toBe(200000); // 2 * (75000 + 25000)
      expect(result.totalAdditions).toBe(500000);
      expect(result.contributionCount).toBe(2);
    });

    it('should return zero for employee with no contributions', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getYtdContributions('emp-123', 2024);

      expect(result.employeeElective).toBe(0);
      expect(result.employerContributions).toBe(0);
      expect(result.totalAdditions).toBe(0);
      expect(result.contributionCount).toBe(0);
    });
  });

  describe('IRS_LIMITS', () => {
    it('should have correct 2024 limits', () => {
      expect(IRS_LIMITS[2024].EMPLOYEE_ELECTIVE_DEFERRAL).toBe(2300000); // $23,000
      expect(IRS_LIMITS[2024].CATCH_UP_CONTRIBUTION).toBe(750000); // $7,500
      expect(IRS_LIMITS[2024].TOTAL_ANNUAL_ADDITIONS).toBe(6900000); // $69,000
    });
  });
});
