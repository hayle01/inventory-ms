import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { DepartmentModel } from '../models/Department.js';
import { WarehouseModel } from '../models/Warehouse.js';
import { StorageLocationModel } from '../models/StorageLocation.js';

export const createOrganizationIndexesMigration: Migration = {
  id: '001-organization-create-indexes',
  description: 'Create indexes for departments, warehouses, and storage locations',
  up: async () => {
    await DepartmentModel.createIndexes();
    await WarehouseModel.createIndexes();
    await StorageLocationModel.createIndexes();
  },
};
