import { randomBytes } from 'node:crypto';
import { connectMongo, disconnectMongo } from './shared/infrastructure/mongo.js';
import { logger } from './shared/observability/logger.js';
import { Organization } from './modules/organization/models/Organization.js';
import { RoleModel } from './modules/access/models/Role.js';
import { UserModel } from './modules/identity/models/User.js';
import { SYSTEM_ROLE_NAMES } from '@inventory-ms/contracts';
import { SYSTEM_ROLE_PERMISSIONS } from './modules/access/domain/permissionCatalog.js';
import { hashPassword } from './modules/identity/domain/password.js';

const DEFAULT_ORG_CODE = process.env['SEED_ORG_CODE'] ?? 'default';
const DEFAULT_ORG_NAME = process.env['SEED_ORG_NAME'] ?? 'Default Organization';
const ADMIN_USERNAME = process.env['SEED_ADMIN_USERNAME'] ?? 'admin';
const ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@example.test';
const ADMIN_FULL_NAME = process.env['SEED_ADMIN_FULL_NAME'] ?? 'System Administrator';

async function seedOrganization() {
  return Organization.findOneAndUpdate(
    { code: DEFAULT_ORG_CODE },
    { $setOnInsert: { code: DEFAULT_ORG_CODE, name: DEFAULT_ORG_NAME } },
    { upsert: true, new: true },
  );
}

async function seedSystemRoles(organizationId: import('mongoose').Types.ObjectId) {
  const roleIdByName = new Map<string, import('mongoose').Types.ObjectId>();
  for (const name of SYSTEM_ROLE_NAMES) {
    const role = await RoleModel.findOneAndUpdate(
      { organizationId, name },
      {
        $set: { permissionNames: SYSTEM_ROLE_PERMISSIONS[name], isSystem: true },
        $setOnInsert: { organizationId, name, description: `System role: ${name}` },
      },
      { upsert: true, new: true },
    );
    roleIdByName.set(name, role._id);
  }
  return roleIdByName;
}

async function seedAdminUser(
  organizationId: import('mongoose').Types.ObjectId,
  administratorRoleId: import('mongoose').Types.ObjectId,
) {
  const existing = await UserModel.findOne({ organizationId, usernameNormalized: ADMIN_USERNAME });
  if (existing) {
    logger.info({ username: ADMIN_USERNAME }, 'Admin user already exists, skipping creation');
    return;
  }

  const password = process.env['SEED_ADMIN_PASSWORD'] ?? randomBytes(18).toString('base64url');
  const passwordHash = await hashPassword(password);

  await UserModel.create({
    organizationId,
    fullName: ADMIN_FULL_NAME,
    usernameNormalized: ADMIN_USERNAME,
    emailNormalized: ADMIN_EMAIL,
    passwordHash,
    status: 'active',
    roleIds: [administratorRoleId],
  });

  process.stdout.write(
    [
      '',
      '==========================================================',
      ' Seeded initial administrator account (shown once):',
      `   username: ${ADMIN_USERNAME}`,
      `   email:    ${ADMIN_EMAIL}`,
      `   password: ${password}`,
      ' Change this password after first login.',
      '==========================================================',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  await connectMongo();
  try {
    const organization = await seedOrganization();
    const roleIdByName = await seedSystemRoles(organization._id);
    const administratorRoleId = roleIdByName.get('Administrator');
    if (!administratorRoleId) throw new Error('Administrator role was not seeded.');
    await seedAdminUser(organization._id, administratorRoleId);
    logger.info({ organization: organization.code }, 'Seed complete');
  } finally {
    await disconnectMongo();
  }
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Seed script failed');
  process.exitCode = 1;
});
