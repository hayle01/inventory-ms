import { Decimal } from 'decimal.js';
import { Types } from 'mongoose';
import type { CreateStockReturnRequest, StockReturnCondition } from '@inventory-ms/contracts';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { withTransaction } from '../../../shared/infrastructure/mongo.js';
import { nextSequence, formatSequence } from '../../../shared/infrastructure/counters/Counter.js';
import {
  hashIdempotencyPayload,
  withIdempotentPost,
} from '../../../shared/infrastructure/idempotency.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { toDecimal128 } from '../../catalog/domain/decimalMapping.js';
import {
  getStockIssueById,
  applyReturnedQuantities,
} from '../../issues/application/IssueService.js';
import {
  postStockMovements,
  type StockMovementInput,
} from '../../inventory/application/LedgerService.js';
import { StockReturnModel, type StockReturnDoc } from '../models/StockReturn.js';
import { assertStockReturnTransition } from '../domain/stockReturnStatus.js';

export interface OrgActionContext {
  organizationId: Types.ObjectId;
  actorId: Types.ObjectId;
  correlationId: string;
}

function stockStateForCondition(condition: StockReturnCondition) {
  return condition === 'good' ? ('available' as const) : condition;
}

export async function listStockReturns(organizationId: Types.ObjectId): Promise<StockReturnDoc[]> {
  return StockReturnModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
}

export async function getStockReturnById(
  organizationId: Types.ObjectId,
  stockReturnId: Types.ObjectId,
): Promise<StockReturnDoc> {
  const stockReturn = await StockReturnModel.findOne({ _id: stockReturnId, organizationId }).lean();
  if (!stockReturn) throw new NotFoundError('Stock return not found.');
  return stockReturn;
}

export async function createStockReturn(
  context: OrgActionContext,
  input: CreateStockReturnRequest,
): Promise<StockReturnDoc> {
  const stockIssueObjectId = new Types.ObjectId(input.stockIssueId);
  const stockIssue = await getStockIssueById(context.organizationId, stockIssueObjectId);
  if (stockIssue.status !== 'posted') {
    throw new ValidationError('Only posted stock issues can be returned against.');
  }

  const issueItemByLine = new Map(stockIssue.items.map((item) => [item.lineNumber, item]));

  const items = input.items.map((input_, index) => {
    const issueItem = issueItemByLine.get(input_.stockIssueLineNumber);
    if (!issueItem) {
      throw new ValidationError(
        `Stock issue line ${String(input_.stockIssueLineNumber)} does not exist on this issue.`,
      );
    }
    const alreadyReturned = new Decimal(issueItem.returnedQuantity.toString());
    const picked = new Decimal(issueItem.pickedQuantity.toString());
    const outstanding = picked.minus(alreadyReturned);
    const quantity = new Decimal(input_.quantity);
    if (quantity.greaterThan(outstanding)) {
      throw new ValidationError(
        `Line ${String(input_.stockIssueLineNumber)} cannot return more than the outstanding picked quantity (${outstanding.toFixed()}).`,
      );
    }

    return {
      lineNumber: index + 1,
      stockIssueLineNumber: issueItem.lineNumber,
      productId: issueItem.productId,
      productName: issueItem.productName,
      productSku: issueItem.productSku,
      locationId: issueItem.locationId,
      lotId: issueItem.lotId ?? null,
      lotNumber: issueItem.lotNumber ?? null,
      quantity: toDecimal128(quantity.toFixed()),
      condition: input_.condition,
      reason: input_.reason ?? null,
    };
  });

  const stockReturn = await withTransaction(
    async (session) => {
      const seq = await nextSequence(`${context.organizationId.toString()}:stockReturn`, session);
      const [created] = await StockReturnModel.create(
        [
          {
            organizationId: context.organizationId,
            returnNumber: formatSequence('RET', seq),
            stockIssueId: stockIssueObjectId,
            warehouseId: stockIssue.warehouseId,
            status: 'draft',
            items,
            notes: input.notes ?? null,
            createdBy: context.actorId,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Stock return creation failed unexpectedly.');
      return created;
    },
    { correlationId: context.correlationId, operation: 'returns.stockReturn.create' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'returns.create',
    resourceType: 'stockReturn',
    resourceId: stockReturn._id,
    resourceNumber: stockReturn.returnNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockReturn.toObject();
}

export async function postStockReturn(
  context: OrgActionContext,
  stockReturnId: Types.ObjectId,
  idempotencyKey: string | undefined,
): Promise<StockReturnDoc> {
  const stockReturn = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'returns.post',
          key: idempotencyKey,
          requestPayload: { stockReturnId: stockReturnId.toString() },
        },
        session,
        async () => {
          const doc = await StockReturnModel.findOne({
            _id: stockReturnId,
            organizationId: context.organizationId,
          }).session(session);
          if (!doc) throw new NotFoundError('Stock return not found.');
          assertStockReturnTransition(doc.status, 'posted');

          const movements: StockMovementInput[] = [];
          const returnedByLine = new Map<number, Decimal>();

          for (const item of doc.items) {
            const quantityDecimal = new Decimal(item.quantity.toString());
            if (quantityDecimal.isZero()) continue;

            movements.push({
              productId: item.productId,
              warehouseId: doc.warehouseId,
              locationId: item.locationId,
              lotId: item.lotId ?? null,
              stockState: stockStateForCondition(item.condition),
              quantity: quantityDecimal.toFixed(),
            });

            returnedByLine.set(
              item.stockIssueLineNumber,
              (returnedByLine.get(item.stockIssueLineNumber) ?? new Decimal(0)).plus(
                quantityDecimal,
              ),
            );
          }

          if (movements.length === 0) {
            throw new BusinessRuleError('This return has no quantity to post.');
          }

          await postStockMovements(
            {
              organizationId: context.organizationId,
              transactionType: 'return',
              referenceType: 'stockReturn',
              referenceId: doc._id,
              referenceNumber: doc.returnNumber,
              actorId: context.actorId,
              correlationId: context.correlationId,
              idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
              movements,
            },
            session,
          );

          await applyReturnedQuantities(
            session,
            context.organizationId,
            doc.stockIssueId,
            returnedByLine,
          );

          doc.status = 'posted';
          doc.postedBy = context.actorId;
          doc.postedAt = new Date();
          doc.version += 1;
          await doc.save({ session });

          return { resultRef: doc._id, result: doc.toObject() };
        },
        async (resultRef) => {
          const existing = await StockReturnModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Stock return not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'returns.stockReturn.post' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'returns.post',
    resourceType: 'stockReturn',
    resourceId: stockReturn._id,
    resourceNumber: stockReturn.returnNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockReturn;
}
