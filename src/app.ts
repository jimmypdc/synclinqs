import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { requestLogger } from './api/middleware/requestLogger.js';
import { metricsMiddleware } from './api/middleware/metrics.js';
import { apiRouter } from './api/routes/index.js';
import healthRoutes from './api/routes/health.routes.js';
import metricsRoutes from './api/routes/metrics.routes.js';
import docsRoutes from './api/routes/docs.routes.js';

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
    })
  );

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // Request logging
  app.use(requestLogger);

  // Metrics collection
  app.use(metricsMiddleware);

  // Health check routes
  app.use('/health', healthRoutes);

  // Metrics endpoint (Prometheus format)
  app.use('/metrics', metricsRoutes);

  // API documentation (Swagger UI) - development only
  app.use('/api/docs', docsRoutes);

  // API routes
  app.use(`/api/${config.apiVersion}`, apiRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}
