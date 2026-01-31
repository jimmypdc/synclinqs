import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { TransformationService } from '../../transformations/index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const testTransformationSchema = z.object({
  name: z.string().min(1),
  input: z.unknown(),
  params: z.record(z.unknown()).optional(),
});

const chainTransformationsSchema = z.object({
  input: z.unknown(),
  transformations: z.array(
    z.object({
      name: z.string().min(1),
      params: z.record(z.unknown()).optional(),
    })
  ).min(1).max(20),
});

export class TransformationsController {
  private service = new TransformationService();

  list = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const transformations = this.service.listTransformations();
      res.json(transformations);
    } catch (error) {
      next(error);
    }
  };

  getByName = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { name } = req.params;
      const transformation = this.service.getTransformation(name!);

      if (!transformation) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Transformation '${name}' not found`,
          },
        });
        return;
      }

      res.json(transformation);
    } catch (error) {
      next(error);
    }
  };

  test = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { name, input, params } = testTransformationSchema.parse(req.body);
      const result = this.service.testTransformation(name, input, params);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  chain = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { input, transformations } = chainTransformationsSchema.parse(req.body);

      const results: Array<{
        transformation: string;
        input: unknown;
        output: unknown;
        success: boolean;
        error?: string;
      }> = [];

      let currentValue = input;
      let allSuccess = true;

      for (const t of transformations) {
        const stepInput = currentValue;
        try {
          currentValue = this.service.transform(t.name, currentValue, t.params);
          results.push({
            transformation: t.name,
            input: stepInput,
            output: currentValue,
            success: true,
          });
        } catch (error) {
          allSuccess = false;
          results.push({
            transformation: t.name,
            input: stepInput,
            output: null,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          break;
        }
      }

      res.json({
        success: allSuccess,
        finalOutput: allSuccess ? currentValue : null,
        steps: results,
      });
    } catch (error) {
      next(error);
    }
  };

  getCategories = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const transformations = this.service.listTransformations();
      const categories: Record<string, string[]> = {};

      for (const t of transformations) {
        const category = t.functionType.toLowerCase();
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(t.name);
      }

      res.json(categories);
    } catch (error) {
      next(error);
    }
  };
}
