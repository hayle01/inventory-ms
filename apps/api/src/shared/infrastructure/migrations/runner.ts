import mongoose, { Schema, type ClientSession, type Connection, type Model } from 'mongoose';
import { logger } from '../../observability/logger.js';

export interface Migration {
  id: string;
  description: string;
  up: (connection: Connection, session: ClientSession) => Promise<void>;
}

interface AppliedMigrationDoc {
  migrationId: string;
  description: string;
  appliedAt: Date;
}

const appliedMigrationSchema = new Schema<AppliedMigrationDoc>(
  {
    migrationId: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    appliedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: 'schemaMigrations' },
);

function appliedMigrationModel(connection: Connection): Model<AppliedMigrationDoc> {
  const existing = connection.models['SchemaMigration'] as Model<AppliedMigrationDoc> | undefined;
  return (
    existing ?? connection.model<AppliedMigrationDoc>('SchemaMigration', appliedMigrationSchema)
  );
}

/**
 * Migrations run outside a MongoDB transaction: index builds (`createIndexes`)
 * are not permitted inside multi-document transactions, so each migration's
 * `up()` must be idempotent on its own (upserts, `createIndexes`, etc.)
 * rather than relying on transactional bookkeeping. A migration that throws
 * is not recorded as applied and will be retried on the next run.
 */
export async function runMigrations(migrations: readonly Migration[]): Promise<void> {
  const connection = mongoose.connection;
  const AppliedMigration = appliedMigrationModel(connection);

  for (const migration of migrations) {
    const existing = await AppliedMigration.findOne({ migrationId: migration.id }).lean();
    if (existing) {
      logger.info({ migrationId: migration.id }, 'Migration already applied, skipping');
      continue;
    }

    const session = await connection.startSession();
    try {
      await migration.up(connection, session);
      await AppliedMigration.create({
        migrationId: migration.id,
        description: migration.description,
      });
      logger.info({ migrationId: migration.id }, 'Migration applied');
    } finally {
      await session.endSession();
    }
  }
}
