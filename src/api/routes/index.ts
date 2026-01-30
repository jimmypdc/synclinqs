import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { contributionsRouter } from './contributions.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { deferralElectionsRouter } from './deferral-elections.routes.js';
import { employeesRouter } from './employees.routes.js';
import { integrationsRouter } from './integrations.routes.js';
import { fileUploadsRouter } from './file-uploads.routes.js';
import { invitationsRouter } from './invitations.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/contributions', contributionsRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/deferral-elections', deferralElectionsRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/integrations', integrationsRouter);
apiRouter.use('/file-uploads', fileUploadsRouter);
apiRouter.use('/invitations', invitationsRouter);
