import type { Migration } from './runner.js';
import { identityMigrations } from '../../../modules/identity/migrations/index.js';
import { accessMigrations } from '../../../modules/access/migrations/index.js';
import { organizationMigrations } from '../../../modules/organization/migrations/index.js';
import { catalogMigrations } from '../../../modules/catalog/migrations/index.js';
import { supplierMigrations } from '../../../modules/suppliers/migrations/index.js';
import { procurementMigrations } from '../../../modules/procurement/migrations/index.js';
import { inventoryMigrations } from '../../../modules/inventory/migrations/index.js';
import { receivingMigrations } from '../../../modules/receiving/migrations/index.js';

/** All migrations in application order. Each module owns and exports its own list. */
export const allMigrations: readonly Migration[] = [
  ...identityMigrations,
  ...accessMigrations,
  ...organizationMigrations,
  ...catalogMigrations,
  ...supplierMigrations,
  ...procurementMigrations,
  ...inventoryMigrations,
  ...receivingMigrations,
];
