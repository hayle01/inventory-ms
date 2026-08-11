import { createHash } from 'node:crypto';
import {
  Schema,
  model,
  Types,
  type ClientSession,
  type InferSchemaType,
  type Model,
} from 'mongoose';
import { registerModel } from './modelRegistry.js';
import { IdempotencyKeyConflictError, IdempotencyKeyRequiredError } from '../http/errors.js';

const idempotencyResultSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true },
    scope: { type: String, required: true },
    key: { type: String, required: true },
    requestHash: { type: String, required: true },
    resultRef: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'idempotencyResults' },
);

idempotencyResultSchema.index({ organizationId: 1, scope: 1, key: 1 }, { unique: true });

type IdempotencyResultDoc = InferSchemaType<typeof idempotencyResultSchema> & {
  _id: Types.ObjectId;
};

const IdempotencyResultModel: Model<IdempotencyResultDoc> = model<IdempotencyResultDoc>(
  'IdempotencyResult',
  idempotencyResultSchema,
);

registerModel('IdempotencyResult', IdempotencyResultModel);

export { IdempotencyResultModel };

export function hashIdempotencyPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Wraps a stock-posting operation with idempotency-key protection. Must run
 * inside the same transaction session as the posting work: on first use it
 * executes `execute` and records the result reference; on replay with the
 * same key and payload it skips `execute` and calls `loadExisting` instead.
 * A key reused with a different payload is a client bug and returns 409.
 */
export async function withIdempotentPost<T>(
  params: {
    organizationId: Types.ObjectId;
    scope: string;
    key: string | undefined;
    requestPayload: unknown;
  },
  session: ClientSession,
  execute: () => Promise<{ resultRef: Types.ObjectId; result: T }>,
  loadExisting: (resultRef: Types.ObjectId) => Promise<T>,
): Promise<T> {
  if (!params.key) throw new IdempotencyKeyRequiredError();
  const requestHash = hashIdempotencyPayload(params.requestPayload);

  const existing = await IdempotencyResultModel.findOne({
    organizationId: params.organizationId,
    scope: params.scope,
    key: params.key,
  }).session(session);

  if (existing) {
    if (existing.requestHash !== requestHash) throw new IdempotencyKeyConflictError();
    return loadExisting(existing.resultRef);
  }

  const { resultRef, result } = await execute();
  await IdempotencyResultModel.create(
    [
      {
        organizationId: params.organizationId,
        scope: params.scope,
        key: params.key,
        requestHash,
        resultRef,
      },
    ],
    { session },
  );
  return result;
}
