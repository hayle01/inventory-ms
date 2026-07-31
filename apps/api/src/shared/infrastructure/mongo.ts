import mongoose, { type ClientSession } from 'mongoose';
import { env } from '../../config.js';
import { logger } from '../observability/logger.js';

export async function connectMongo(): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    readPreference: 'primary',
  });
  logger.info({ dbName: env.MONGODB_DB_NAME }, 'Connected to MongoDB');
  return mongoose;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

const TRANSIENT_ERROR_LABELS = ['TransientTransactionError', 'UnknownTransactionCommitResult'];
const MAX_TRANSACTION_ATTEMPTS = 3;

interface ErrorWithLabel {
  hasErrorLabel: (label: string) => boolean;
}

function isErrorWithLabel(error: unknown): error is ErrorWithLabel {
  return (
    typeof error === 'object' &&
    error !== null &&
    'hasErrorLabel' in error &&
    typeof (error as ErrorWithLabel).hasErrorLabel === 'function'
  );
}

function hasErrorLabel(error: unknown, label: string): boolean {
  return isErrorWithLabel(error) && error.hasErrorLabel(label);
}

function isRetryableTransactionError(error: unknown): boolean {
  return TRANSIENT_ERROR_LABELS.some((label) => hasErrorLabel(error, label));
}

/**
 * Runs `work` inside a MongoDB multi-document transaction using majority
 * write/read concern. Retries only recognized transient transaction or
 * unknown-commit-result errors, with a bounded attempt count. All operations
 * inside `work` must be sequential (no `Promise.all`) and must not perform
 * external network calls (email, SMS, object storage, PDF generation).
 */
export async function withTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
  context: { correlationId: string; operation: string },
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_TRANSACTION_ATTEMPTS) {
    attempt += 1;
    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(
        async () => {
          result = await work(session);
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary',
        },
      );
      return result;
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt >= MAX_TRANSACTION_ATTEMPTS) {
        logger.error(
          { err: error, attempt, ...context },
          'MongoDB transaction failed without further retry',
        );
        throw error;
      }
      logger.warn(
        { err: error, attempt, ...context },
        'Retrying MongoDB transaction after transient error',
      );
    } finally {
      await session.endSession();
    }
  }

  throw lastError;
}
