import 'dotenv/config';
import mongoose, { Schema, type Model } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTransaction } from '../../src/shared/infrastructure/mongo.js';

/**
 * Phase 0 exit criterion: prove the configured MongoDB target is a real
 * replica set that supports multi-document transactions, and that our
 * transaction wrapper commits and rolls back correctly. This must run
 * against `infra/docker/compose` (or an equivalent replica set) -- never
 * against a standalone MongoDB or in-memory mock.
 */

interface SmokeTestDoc {
  label: string;
  value: number;
}

const smokeTestSchema = new Schema<SmokeTestDoc>(
  { label: String, value: Number },
  { collection: 'phase0SmokeTest' },
);

function getSmokeTestModel(): Model<SmokeTestDoc> {
  const existing = mongoose.connection.models['Phase0SmokeTest'] as Model<SmokeTestDoc> | undefined;
  return existing ?? mongoose.connection.model<SmokeTestDoc>('Phase0SmokeTest', smokeTestSchema);
}

describe('MongoDB replica-set transaction smoke test', () => {
  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await mongoose.connect(uri, { dbName: process.env['MONGODB_DB_NAME'] ?? 'ims_test' });
  });

  afterAll(async () => {
    await getSmokeTestModel().deleteMany({});
    await mongoose.disconnect();
  });

  it('commits a multi-document write inside a transaction', async () => {
    const SmokeTest = getSmokeTestModel();

    const result = await withTransaction(
      async (session) => {
        const [a] = await SmokeTest.create([{ label: 'a', value: 1 }], { session });
        const [b] = await SmokeTest.create([{ label: 'b', value: 2 }], { session });
        if (!a || !b) throw new Error('expected both documents to be created');
        return { aId: a._id, bId: b._id };
      },
      { correlationId: 'smoke-test-commit', operation: 'phase0.smoke.commit' },
    );

    const docs = await SmokeTest.find({ _id: { $in: [result.aId, result.bId] } }).lean();
    expect(docs).toHaveLength(2);
  });

  it('rolls back all writes when the transaction body throws', async () => {
    const SmokeTest = getSmokeTestModel();
    const marker = `rollback-${String(Date.now())}`;

    await expect(
      withTransaction(
        async (session) => {
          await SmokeTest.create([{ label: marker, value: 1 }], { session });
          throw new Error('intentional failure to force rollback');
        },
        { correlationId: 'smoke-test-rollback', operation: 'phase0.smoke.rollback' },
      ),
    ).rejects.toThrow('intentional failure to force rollback');

    const docs = await SmokeTest.find({ label: marker }).lean();
    expect(docs).toHaveLength(0);
  });
});
