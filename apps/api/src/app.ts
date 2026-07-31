import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import type { Request, Response } from 'express';
import { logger } from './shared/observability/logger.js';
import { correlationIdMiddleware } from './shared/http/correlationId.js';
import { errorHandler, notFoundHandler } from './shared/http/errorHandler.js';
import {
  applyProxyTrust,
  corsMiddleware,
  helmetMiddleware,
  requestTimeoutMiddleware,
  JSON_BODY_LIMIT,
} from './shared/security/security.js';
import { operationsRouter } from './modules/operations/http/operationsRouter.js';
import { sessionMiddleware } from './shared/security/sessionMiddleware.js';
import { authRouter } from './modules/identity/http/authRouter.js';
import { meRouter } from './modules/identity/http/meRouter.js';
import { usersRouter } from './modules/identity/http/usersRouter.js';
import { rolesRouter } from './modules/access/http/rolesRouter.js';
import { permissionsRouter } from './modules/access/http/permissionsRouter.js';
import { organizationRouter } from './modules/organization/http/organizationRouter.js';
import { departmentsRouter } from './modules/organization/http/departmentsRouter.js';
import { warehousesRouter } from './modules/organization/http/warehousesRouter.js';
import { categoriesRouter } from './modules/catalog/http/categoriesRouter.js';
import { unitsRouter } from './modules/catalog/http/unitsRouter.js';
import { productsRouter } from './modules/catalog/http/productsRouter.js';
import { suppliersRouter } from './modules/suppliers/http/suppliersRouter.js';
import { purchaseOrdersRouter } from './modules/procurement/http/purchaseOrdersRouter.js';

export function createApp(): Express {
  const app = express();

  applyProxyTrust(app);
  app.disable('x-powered-by');

  app.use(correlationIdMiddleware);
  app.use(requestTimeoutMiddleware);
  app.use(helmetMiddleware());
  app.use(corsMiddleware());
  app.use(cookieParser());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(sessionMiddleware());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req: Request) => req.correlationId,
      customLogLevel: (_req: Request, res: Response, err?: Error) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use('/api/v1/operations', operationsRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/me', meRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/permissions', permissionsRouter);
  app.use('/api/v1/organization', organizationRouter);
  app.use('/api/v1/departments', departmentsRouter);
  app.use('/api/v1/warehouses', warehousesRouter);
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/units', unitsRouter);
  app.use('/api/v1/products', productsRouter);
  app.use('/api/v1/suppliers', suppliersRouter);
  app.use('/api/v1/purchase-orders', purchaseOrdersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
