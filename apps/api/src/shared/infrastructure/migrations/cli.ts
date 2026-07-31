import { connectMongo, disconnectMongo } from '../mongo.js';
import { listRegisteredModels } from '../modelRegistry.js';
import { logger } from '../../observability/logger.js';
import { allMigrations } from './index.js';
import { runMigrations } from './runner.js';
import '../../../modules/identity/models/index.js';
import '../../../modules/access/models/index.js';
import '../../../modules/organization/models/index.js';
import '../../../modules/catalog/models/index.js';
import '../../../modules/suppliers/models/index.js';
import '../../../modules/procurement/models/index.js';
import '../../../modules/audit/models/index.js';

async function verifyIndexes(): Promise<void> {
  const models = listRegisteredModels();
  if (models.size === 0) {
    logger.info('No models registered yet; nothing to verify.');
    return;
  }

  let hasDrift = false;
  for (const [name, model] of models) {
    const diff = await model.diffIndexes();
    const toCreate = diff.toCreate;
    const toDrop = diff.toDrop;
    if (toCreate.length > 0 || toDrop.length > 0) {
      hasDrift = true;
      logger.error({ model: name, toCreate, toDrop }, 'Index drift detected');
    } else {
      logger.info({ model: name }, 'Indexes match schema definition');
    }
  }

  if (hasDrift) {
    throw new Error('Index drift detected. Run db:migrate or add a migration before deploying.');
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  await connectMongo();
  try {
    if (command === 'up') {
      await runMigrations(allMigrations);
    } else if (command === 'verify-indexes') {
      await verifyIndexes();
    } else {
      throw new Error(
        `Unknown migration command: ${command ?? '(none)'}. Use "up" or "verify-indexes".`,
      );
    }
  } finally {
    await disconnectMongo();
  }
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Migration command failed');
  process.exitCode = 1;
});
