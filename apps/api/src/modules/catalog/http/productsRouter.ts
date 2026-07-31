import { Router } from 'express';
import { Types } from 'mongoose';
import {
  createProductRequestSchema,
  productSearchQuerySchema,
  updateProductRequestSchema,
} from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendPaginated, sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody, validateQuery } from '../../../shared/http/validate.js';
import { doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { rateLimit } from '../../../shared/security/rateLimit.js';
import { rateLimitPolicies } from '../../../config.js';
import { ValidationError } from '../../../shared/http/errors.js';
import * as ProductService from '../application/ProductService.js';
import { toProductDto } from './mappers.js';

export const productsRouter: Router = Router();

productsRouter.use(requireAuth);

function parseObjectId(value: string | undefined): Types.ObjectId {
  try {
    return new Types.ObjectId(value);
  } catch {
    throw new ValidationError('Invalid id.');
  }
}

productsRouter.get(
  '/search',
  requirePermission('products.view'),
  rateLimit(
    'search',
    rateLimitPolicies.search,
    (req) => req.authContext?.userId.toString() ?? 'anonymous',
  ),
  validateQuery(productSearchQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ReturnType<(typeof productSearchQuerySchema)['parse']>;
    const { items, total } = await ProductService.searchProducts(
      getAuthContext(req).organizationId,
      query,
    );
    sendPaginated(res, items.map(toProductDto), {
      page: query.page,
      perPage: query.perPage,
      total,
    });
  }),
);

productsRouter.get(
  '/',
  requirePermission('products.view'),
  asyncHandler(async (req, res) => {
    const products = await ProductService.listProducts(getAuthContext(req).organizationId);
    sendSuccess(res, products.map(toProductDto));
  }),
);

productsRouter.post(
  '/',
  requirePermission('products.create'),
  doubleCsrfProtection,
  validateBody(createProductRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const product = await ProductService.createProduct(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof ProductService.createProduct>[1],
    );
    sendSuccess(res, toProductDto(product), 201);
  }),
);

productsRouter.get(
  '/:id',
  requirePermission('products.view'),
  asyncHandler(async (req, res) => {
    const product = await ProductService.getProductById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toProductDto(product));
  }),
);

productsRouter.patch(
  '/:id',
  requirePermission('products.update'),
  doubleCsrfProtection,
  validateBody(updateProductRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const product = await ProductService.updateProduct(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof ProductService.updateProduct>[2],
    );
    sendSuccess(res, toProductDto(product));
  }),
);

productsRouter.post(
  '/:id/archive',
  requirePermission('products.archive'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const product = await ProductService.archiveProduct(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toProductDto(product));
  }),
);
