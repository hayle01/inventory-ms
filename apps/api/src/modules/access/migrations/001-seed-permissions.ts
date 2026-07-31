import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { PermissionModel } from '../models/Permission.js';
import { PERMISSION_CATALOG } from '../domain/permissionCatalog.js';

export const seedPermissionsMigration: Migration = {
  id: '001-access-seed-permissions',
  description: 'Seed the global permission catalog from @inventory-ms/contracts',
  up: async (_connection, session) => {
    for (const entry of PERMISSION_CATALOG) {
      await PermissionModel.findOneAndUpdate(
        { name: entry.name },
        { $set: entry },
        { upsert: true, session },
      );
    }
  },
};
