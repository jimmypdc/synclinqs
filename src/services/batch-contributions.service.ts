import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import { ContributionValidationService, ValidationResult } from './contribution-validation.service.js';
import { ContributionCsvRow, parseCsvContent, CsvParseError } from '../utils/csv-parser.js';
import { logger } from '../utils/logger.js';

export interface BatchProcessResult {
  fileUploadId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  summary: {
    totalRows: number;
    validRows: number;
    createdCount: number;
    errorCount: number;
    warningCount: number;
  };
  parseErrors: CsvParseError[];
  validationErrors: BatchValidationError[];
  warnings: BatchWarning[];
  createdContributions: string[];
}

export interface BatchValidationError {
  row: number;
  employeeNumber: string;
  errors: Array<{
    field: string;
    code: string;
    message: string;
  }>;
}

export interface BatchWarning {
  row: number;
  employeeNumber: string;
  warnings: Array<{
    field: string;
    code: string;
    message: string;
  }>;
}

export class BatchContributionsService {
  private auditService = new AuditService();
  private validationService = new ContributionValidationService();

  async processFile(
    fileContent: string,
    fileName: string,
    fileSize: number,
    integrationId: string,
    planId: string,
    organizationId: string,
    userId: string
  ): Promise<BatchProcessResult> {
    // Create file upload record
    const fileUpload = await prisma.fileUpload.create({
      data: {
        integrationId,
        fileName,
        fileSize,
        fileType: 'text/csv',
        status: 'PROCESSING',
        createdBy: userId,
      },
    });

    const parseErrors: CsvParseError[] = [];
    const validationErrors: BatchValidationError[] = [];
    const warnings: BatchWarning[] = [];
    const createdContributions: string[] = [];

    try {
      // Parse CSV
      const parseResult = parseCsvContent(fileContent);

      if (parseResult.errors.length > 0) {
        parseErrors.push(...parseResult.errors);
      }

      if (parseResult.data.length === 0) {
        // No valid data to process
        await this.updateFileUpload(fileUpload.id, {
          status: 'FAILED',
          recordCount: 0,
          errorCount: parseResult.errors.length,
          errorDetails: JSON.stringify({ parseErrors: parseResult.errors }),
        });

        return {
          fileUploadId: fileUpload.id,
          status: 'FAILED',
          summary: {
            totalRows: parseResult.totalRows,
            validRows: 0,
            createdCount: 0,
            errorCount: parseResult.errors.length,
            warningCount: 0,
          },
          parseErrors,
          validationErrors: [],
          warnings: [],
          createdContributions: [],
        };
      }

      // Look up employees by employee number
      const employeeNumbers = [...new Set(parseResult.data.map(r => r.employeeNumber))];
      const employees = await prisma.employee.findMany({
        where: {
          organizationId,
          employeeNumber: { in: employeeNumbers },
          deletedAt: null,
        },
        select: {
          id: true,
          employeeNumber: true,
          planId: true,
          status: true,
        },
      });

      const employeeMap = new Map(employees.map(e => [e.employeeNumber, e]));

      // Process each row
      const rowsToCreate: Array<{
        row: number;
        data: ContributionCsvRow;
        employeeId: string;
        validation: ValidationResult;
      }> = [];

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i]!;
        const rowNumber = i + 2; // Account for header and 1-indexing

        // Find employee
        const employee = employeeMap.get(row.employeeNumber);
        if (!employee) {
          validationErrors.push({
            row: rowNumber,
            employeeNumber: row.employeeNumber,
            errors: [{
              field: 'employeeNumber',
              code: 'EMPLOYEE_NOT_FOUND',
              message: `Employee not found: ${row.employeeNumber}`,
            }],
          });
          continue;
        }

        // Check employee is in the correct plan
        if (employee.planId !== planId) {
          validationErrors.push({
            row: rowNumber,
            employeeNumber: row.employeeNumber,
            errors: [{
              field: 'planId',
              code: 'EMPLOYEE_NOT_IN_PLAN',
              message: `Employee ${row.employeeNumber} is not enrolled in this plan`,
            }],
          });
          continue;
        }

        // Validate contribution against IRS limits
        const validation = await this.validationService.validateContribution({
          employeeId: employee.id,
          planId,
          payrollDate: row.payrollDate,
          employeePreTax: row.employeePreTax,
          employeeRoth: row.employeeRoth,
          employerMatch: row.employerMatch,
          employerNonMatch: row.employerNonMatch,
          loanRepayment: row.loanRepayment,
        });

        if (!validation.valid) {
          validationErrors.push({
            row: rowNumber,
            employeeNumber: row.employeeNumber,
            errors: validation.errors.map(e => ({
              field: e.field,
              code: e.code,
              message: e.message,
            })),
          });
          continue;
        }

        if (validation.warnings.length > 0) {
          warnings.push({
            row: rowNumber,
            employeeNumber: row.employeeNumber,
            warnings: validation.warnings.map(w => ({
              field: w.field,
              code: w.code,
              message: w.message,
            })),
          });
        }

        rowsToCreate.push({
          row: rowNumber,
          data: row,
          employeeId: employee.id,
          validation,
        });
      }

      // Create contributions in a transaction
      if (rowsToCreate.length > 0) {
        const created = await prisma.$transaction(async (tx) => {
          const contributions = [];

          for (const item of rowsToCreate) {
            const contribution = await tx.contribution.create({
              data: {
                employeeId: item.employeeId,
                planId,
                payrollDate: new Date(item.data.payrollDate),
                employeePreTax: item.data.employeePreTax,
                employeeRoth: item.data.employeeRoth,
                employerMatch: item.data.employerMatch,
                employerNonMatch: item.data.employerNonMatch,
                loanRepayment: item.data.loanRepayment,
                status: 'PENDING',
                createdBy: userId,
              },
            });
            contributions.push(contribution.id);
          }

          return contributions;
        });

        createdContributions.push(...created);
      }

      // Determine final status
      let status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
      if (createdContributions.length === parseResult.data.length) {
        status = 'COMPLETED';
      } else if (createdContributions.length > 0) {
        status = 'PARTIAL';
      } else {
        status = 'FAILED';
      }

      // Update file upload record
      await this.updateFileUpload(fileUpload.id, {
        status: status === 'FAILED' ? 'FAILED' : 'COMPLETED',
        recordCount: createdContributions.length,
        errorCount: parseErrors.length + validationErrors.length,
        errorDetails: JSON.stringify({
          parseErrors,
          validationErrors,
        }),
      });

      // Audit log
      await this.auditService.log({
        userId,
        action: 'BATCH_UPLOAD',
        entityType: 'FileUpload',
        entityId: fileUpload.id,
        newValues: {
          fileName,
          totalRows: parseResult.totalRows,
          createdCount: createdContributions.length,
          errorCount: parseErrors.length + validationErrors.length,
          status,
        },
      });

      logger.info('Batch contribution processing completed', {
        fileUploadId: fileUpload.id,
        fileName,
        status,
        totalRows: parseResult.totalRows,
        createdCount: createdContributions.length,
        errorCount: parseErrors.length + validationErrors.length,
      });

      return {
        fileUploadId: fileUpload.id,
        status,
        summary: {
          totalRows: parseResult.totalRows,
          validRows: parseResult.validRows,
          createdCount: createdContributions.length,
          errorCount: parseErrors.length + validationErrors.length,
          warningCount: warnings.length,
        },
        parseErrors,
        validationErrors,
        warnings,
        createdContributions,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Batch contribution processing failed', {
        fileUploadId: fileUpload.id,
        error: err.message,
      });

      await this.updateFileUpload(fileUpload.id, {
        status: 'FAILED',
        errorDetails: JSON.stringify({ error: err.message }),
      });

      throw createError('Batch processing failed', 500, 'BATCH_PROCESSING_FAILED');
    }
  }

  private async updateFileUpload(
    id: string,
    data: {
      status?: 'COMPLETED' | 'FAILED';
      recordCount?: number;
      errorCount?: number;
      errorDetails?: string;
    }
  ) {
    await prisma.fileUpload.update({
      where: { id },
      data: {
        ...data,
        processedAt: new Date(),
      },
    });
  }

  async getFileUpload(id: string, organizationId: string) {
    const fileUpload = await prisma.fileUpload.findFirst({
      where: {
        id,
        integration: { organizationId },
      },
      include: {
        integration: { select: { id: true, name: true } },
      },
    });

    if (!fileUpload) {
      throw createError('File upload not found', 404, 'NOT_FOUND');
    }

    return fileUpload;
  }

  async listFileUploads(
    organizationId: string,
    options: { page: number; limit: number; integrationId?: string }
  ) {
    const where: Record<string, unknown> = {
      integration: { organizationId },
    };

    if (options.integrationId) {
      where.integrationId = options.integrationId;
    }

    const [uploads, total] = await Promise.all([
      prisma.fileUpload.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        include: {
          integration: { select: { id: true, name: true } },
        },
      }),
      prisma.fileUpload.count({ where }),
    ]);

    return {
      data: uploads,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit),
      },
    };
  }
}
