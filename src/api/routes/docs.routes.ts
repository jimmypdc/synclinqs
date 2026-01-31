import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPIDocument } from '../openapi.js';
import { config } from '../../config/index.js';

const router = Router();

// Only enable Swagger UI in development
if (config.nodeEnv !== 'production') {
  const openApiDocument = generateOpenAPIDocument();

  router.use('/', swaggerUi.serve);
  router.get('/', swaggerUi.setup(openApiDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'SyncLinqs API Documentation',
  }));

  // Serve raw OpenAPI JSON
  router.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
}

export default router;
