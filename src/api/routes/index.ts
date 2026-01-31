import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { contributionsRouter } from './contributions.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { deferralElectionsRouter } from './deferral-elections.routes.js';
import { employeesRouter } from './employees.routes.js';
import { integrationsRouter } from './integrations.routes.js';
import { fileUploadsRouter } from './file-uploads.routes.js';
import { invitationsRouter } from './invitations.routes.js';
import { mappingsRouter } from './mappings.routes.js';
import { mappingTemplatesRouter } from './mapping-templates.routes.js';
import { fieldDefinitionsRouter } from './field-definitions.routes.js';
import { transformationsRouter } from './transformations.routes.js';
import { validationRulesRouter } from './validation-rules.routes.js';
import { errorsRouter } from './errors.routes.js';
import { reconciliationRouter } from './reconciliation.routes.js';
import { notificationsRouter, alertRulesRouter } from './notifications.routes.js';
import { jobsRouter } from './jobs.routes.js';
import { deduplicationRouter } from './deduplication.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/contributions', contributionsRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/deferral-elections', deferralElectionsRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/integrations', integrationsRouter);
apiRouter.use('/file-uploads', fileUploadsRouter);
apiRouter.use('/invitations', invitationsRouter);

// Mapping system routes
apiRouter.use('/mappings', mappingsRouter);
apiRouter.use('/mapping-templates', mappingTemplatesRouter);
apiRouter.use('/field-definitions', fieldDefinitionsRouter);
apiRouter.use('/transformations', transformationsRouter);
apiRouter.use('/validation-rules', validationRulesRouter);

// Error queue routes
apiRouter.use('/errors', errorsRouter);

// Phase 3: Reconciliation routes
apiRouter.use('/reconciliation', reconciliationRouter);

// Phase 3: Notification routes
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/alert-rules', alertRulesRouter);

// Phase 3: Scheduled jobs routes
apiRouter.use('/jobs', jobsRouter);

// Phase 3: Deduplication routes
apiRouter.use('/deduplication', deduplicationRouter);
