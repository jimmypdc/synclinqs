import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { BatchContributionsService } from '../../services/batch-contributions.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { generateSampleCsv } from '../../utils/csv-parser.js';
import { createError } from '../middleware/errorHandler.js';

const uploadSchema = z.object({
  integrationId: z.string().uuid(),
  planId: z.string().uuid(),
  fileContent: z.string().min(1),
  fileName: z.string().min(1),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  integrationId: z.string().uuid().optional(),
});

export class FileUploadsController {
  private batchService = new BatchContributionsService();

  /**
   * Upload and process a CSV file with contribution data
   */
  upload = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { integrationId, planId, fileContent, fileName } = uploadSchema.parse(req.body);

      // Validate file size (max 5MB when base64 encoded)
      const fileSize = Buffer.byteLength(fileContent, 'utf8');
      if (fileSize > 5 * 1024 * 1024) {
        throw createError('File too large. Maximum size is 5MB', 400, 'FILE_TOO_LARGE');
      }

      const result = await this.batchService.processFile(
        fileContent,
        fileName,
        fileSize,
        integrationId,
        planId,
        req.user!.organizationId,
        req.user!.userId
      );

      // Return appropriate status code based on result
      const statusCode = result.status === 'COMPLETED' ? 201 :
                         result.status === 'PARTIAL' ? 207 : 400;

      res.status(statusCode).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * List file uploads for the organization
   */
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await this.batchService.listFileUploads(
        req.user!.organizationId,
        query
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a specific file upload by ID
   */
  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const upload = await this.batchService.getFileUpload(id!, req.user!.organizationId);
      res.json(upload);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a sample CSV template
   */
  getSampleCsv = async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const csv = generateSampleCsv();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contribution_template.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  };
}
