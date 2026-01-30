import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { contributionsRouter } from './contributions.routes.js';
import { employeesRouter } from './employees.routes.js';
import { integrationsRouter } from './integrations.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/contributions', contributionsRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/integrations', integrationsRouter);
