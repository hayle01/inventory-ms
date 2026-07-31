import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { PermissionModel } from '../models/Permission.js';
import { RoleModel } from '../models/Role.js';

export const createAccessIndexesMigration: Migration = {
  id: '002-access-create-indexes',
  description: 'Create indexes for permissions and roles',
  up: async () => {
    await PermissionModel.createIndexes();
    await RoleModel.createIndexes();
  },
};
