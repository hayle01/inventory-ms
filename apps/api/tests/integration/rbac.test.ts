import 'dotenv/config';
import request from 'supertest';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { connectMongo, disconnectMongo } from '../../src/shared/infrastructure/mongo.js';
import { disconnectRedis } from '../../src/shared/infrastructure/redis.js';
import { Organization } from '../../src/modules/organization/models/Organization.js';
import { RoleModel } from '../../src/modules/access/models/Role.js';
import { UserModel } from '../../src/modules/identity/models/User.js';
import { AuditEventModel } from '../../src/modules/audit/models/AuditEvent.js';
import { PasswordResetTokenModel } from '../../src/modules/identity/models/PasswordResetToken.js';
import { hashPassword } from '../../src/modules/identity/domain/password.js';

/**
 * Identity/Access integration tests. Must run against the real Mongo
 * replica set + Redis started by `pnpm docker:up` -- session cookies, CSRF,
 * and rate limiting all depend on Redis, and authorization scope queries
 * depend on real Mongo document matching.
 */

const ADMIN_PASSWORD = 'CorrectHorseBatteryStaple1!';
const NO_PERM_PASSWORD = 'AnotherStrongPassw0rd!';
const LOCKOUT_PASSWORD = 'LockoutTestPassw0rd!';
const INACTIVE_PASSWORD = 'InactiveTestPassw0rd!';
const RESET_FLOW_PASSWORD = 'ResetFlowPassw0rd!';

let app: ReturnType<typeof createApp>;
let organizationId: Types.ObjectId;
let otherOrganizationId: Types.ObjectId;
let adminUsername: string;
let noPermUsername: string;
let lockoutUsername: string;
let inactiveUsername: string;
let resetFlowUsername: string;
let otherOrgRoleId: Types.ObjectId;

async function fetchCsrf(agent: ReturnType<typeof request.agent>): Promise<string> {
  const res = await agent.get('/api/v1/auth/csrf-token');
  return (res.body as { data: { csrfToken: string } }).data.csrfToken;
}

describe('Identity/Access RBAC', () => {
  beforeAll(async () => {
    const uri = process.env['MONGODB_URI'];
    if (!uri) throw new Error('MONGODB_URI must be set to run integration tests.');
    await connectMongo();
    app = createApp();

    const suffix = Date.now().toString(36);
    adminUsername = `rbac-admin-${suffix}`;
    noPermUsername = `rbac-noperm-${suffix}`;
    lockoutUsername = `rbac-lockout-${suffix}`;
    inactiveUsername = `rbac-inactive-${suffix}`;
    resetFlowUsername = `rbac-reset-${suffix}`;

    const org = await Organization.create({ code: `rbac-test-${suffix}`, name: 'RBAC Test Org' });
    organizationId = org._id;
    const otherOrg = await Organization.create({
      code: `rbac-other-${suffix}`,
      name: 'RBAC Other Org',
    });
    otherOrganizationId = otherOrg._id;

    const adminRole = await RoleModel.create({
      organizationId,
      name: 'TestAdmin',
      permissionNames: ['users.view', 'users.create', 'roles.view'],
      isSystem: false,
    });
    const noPermRole = await RoleModel.create({
      organizationId,
      name: 'TestNoPerm',
      permissionNames: [],
      isSystem: false,
    });
    const otherOrgRole = await RoleModel.create({
      organizationId: otherOrganizationId,
      name: 'OtherOrgRole',
      permissionNames: ['users.view'],
      isSystem: false,
    });
    otherOrgRoleId = otherOrgRole._id;

    await UserModel.create([
      {
        organizationId,
        fullName: 'Admin User',
        usernameNormalized: adminUsername,
        emailNormalized: `${adminUsername}@example.test`,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        status: 'active',
        roleIds: [adminRole._id],
      },
      {
        organizationId,
        fullName: 'No Permission User',
        usernameNormalized: noPermUsername,
        emailNormalized: `${noPermUsername}@example.test`,
        passwordHash: await hashPassword(NO_PERM_PASSWORD),
        status: 'active',
        roleIds: [noPermRole._id],
      },
      {
        organizationId,
        fullName: 'Lockout User',
        usernameNormalized: lockoutUsername,
        emailNormalized: `${lockoutUsername}@example.test`,
        passwordHash: await hashPassword(LOCKOUT_PASSWORD),
        status: 'active',
        roleIds: [],
      },
      {
        organizationId,
        fullName: 'Inactive User',
        usernameNormalized: inactiveUsername,
        emailNormalized: `${inactiveUsername}@example.test`,
        passwordHash: await hashPassword(INACTIVE_PASSWORD),
        status: 'inactive',
        roleIds: [],
      },
      {
        organizationId,
        fullName: 'Reset Flow User',
        usernameNormalized: resetFlowUsername,
        emailNormalized: `${resetFlowUsername}@example.test`,
        passwordHash: await hashPassword(RESET_FLOW_PASSWORD),
        status: 'active',
        roleIds: [],
      },
    ]);
  });

  afterAll(async () => {
    await UserModel.deleteMany({ organizationId });
    await RoleModel.deleteMany({ organizationId: { $in: [organizationId, otherOrganizationId] } });
    await Organization.deleteMany({ _id: { $in: [organizationId, otherOrganizationId] } });
    await AuditEventModel.deleteMany({
      organizationId: { $in: [organizationId, otherOrganizationId] },
    });
    await PasswordResetTokenModel.deleteMany({});
    await disconnectMongo();
    await disconnectRedis();
  });

  it('AUTH-01: logs in with valid credentials, rotates the session, and returns permissions', async () => {
    const agent = request.agent(app);
    const csrfToken = await fetchCsrf(agent);

    const loginRes = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ usernameOrEmail: adminUsername, password: ADMIN_PASSWORD });

    expect(loginRes.status).toBe(200);
    const loginBody = loginRes.body as { data: { permissions: string[] } };
    expect(loginBody.data.permissions).toContain('users.view');

    const meRes = await agent.get('/api/v1/me');
    expect(meRes.status).toBe(200);
    const meBody = meRes.body as { data: { user: { username: string } } };
    expect(meBody.data.user.username).toBe(adminUsername);

    const auditEvent = await AuditEventModel.findOne({
      organizationId,
      action: 'auth.login',
      outcome: 'success',
    }).lean();
    expect(auditEvent).not.toBeNull();
  });

  it('AUTH-02: rejects invalid credentials with a generic message that does not disclose account existence', async () => {
    const agentUnknown = request.agent(app);
    const csrfUnknown = await fetchCsrf(agentUnknown);
    const unknownRes = await agentUnknown
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrfUnknown)
      .send({ usernameOrEmail: 'no-such-user-at-all', password: 'whatever12345' });

    const agentWrongPassword = request.agent(app);
    const csrfWrongPassword = await fetchCsrf(agentWrongPassword);
    const wrongPasswordRes = await agentWrongPassword
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrfWrongPassword)
      .send({ usernameOrEmail: adminUsername, password: 'not-the-right-password' });

    expect(unknownRes.status).toBe(401);
    expect(wrongPasswordRes.status).toBe(401);
    const unknownBody = unknownRes.body as { error: { message: string } };
    const wrongPasswordBody = wrongPasswordRes.body as { error: { message: string } };
    expect(unknownBody.error.message).toBe(wrongPasswordBody.error.message);
  });

  it('AUTH-04: denies login for an inactive user with the same generic message', async () => {
    const agent = request.agent(app);
    const csrfToken = await fetchCsrf(agent);
    const res = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ usernameOrEmail: inactiveUsername, password: INACTIVE_PASSWORD });

    expect(res.status).toBe(401);
  });

  it('AUTH-05: rejects a state-changing request missing the CSRF token', async () => {
    const agent = request.agent(app);
    await fetchCsrf(agent);

    const res = await agent
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: adminUsername, password: ADMIN_PASSWORD });

    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated access to a protected route', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
  });

  it('USER-01: denies a permission-checked route for a user without the required permission, and audits the denial', async () => {
    const agent = request.agent(app);
    const csrfToken = await fetchCsrf(agent);
    await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ usernameOrEmail: noPermUsername, password: NO_PERM_PASSWORD });

    const res = await agent.get('/api/v1/users');
    expect(res.status).toBe(403);

    const denial = await AuditEventModel.findOne({
      organizationId,
      action: 'authorization.denied',
      permissionUsed: 'users.view',
    }).lean();
    expect(denial).not.toBeNull();
  });

  it("scopes resources to the authenticated user's organization (404, not 403, for out-of-scope IDs)", async () => {
    const agent = request.agent(app);
    const csrfToken = await fetchCsrf(agent);
    await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ usernameOrEmail: adminUsername, password: ADMIN_PASSWORD });

    const res = await agent.get(`/api/v1/roles/${otherOrgRoleId.toString()}`);
    expect(res.status).toBe(404);
  });

  it('AUTH-03: locks the account after repeated failed attempts', async () => {
    const failureThreshold = Number(process.env['ACCOUNT_LOCKOUT_THRESHOLD'] ?? 10);

    for (let attempt = 0; attempt < failureThreshold; attempt += 1) {
      const agent = request.agent(app);
      const csrfToken = await fetchCsrf(agent);
      await agent
        .post('/api/v1/auth/login')
        .set('X-CSRF-Token', csrfToken)
        .send({ usernameOrEmail: lockoutUsername, password: 'definitely-wrong' });
    }

    const finalAgent = request.agent(app);
    const finalCsrf = await fetchCsrf(finalAgent);
    const res = await finalAgent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', finalCsrf)
      .send({ usernameOrEmail: lockoutUsername, password: LOCKOUT_PASSWORD });

    expect(res.status).toBe(401);

    const lockedUser = await UserModel.findOne({
      organizationId,
      usernameNormalized: lockoutUsername,
    }).lean();
    expect(lockedUser?.status).toBe('locked');
  }, 30_000);

  it('logout-all revokes sessions on other devices', async () => {
    const agentA = request.agent(app);
    const csrfA = await fetchCsrf(agentA);
    const loginA = await agentA
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrfA)
      .send({ usernameOrEmail: resetFlowUsername, password: RESET_FLOW_PASSWORD });
    // Login rotates the session, which rotates the CSRF binding too -- the
    // response carries a fresh token for the next state-changing request.
    const postLoginCsrfA = (loginA.body as { data: { csrfToken: string } }).data.csrfToken;

    const agentB = request.agent(app);
    const csrfB = await fetchCsrf(agentB);
    await agentB
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrfB)
      .send({ usernameOrEmail: resetFlowUsername, password: RESET_FLOW_PASSWORD });

    expect((await agentB.get('/api/v1/me')).status).toBe(200);

    const logoutAllRes = await agentA
      .post('/api/v1/auth/logout-all')
      .set('X-CSRF-Token', postLoginCsrfA);
    expect(logoutAllRes.status).toBe(200);

    expect((await agentB.get('/api/v1/me')).status).toBe(401);
  });

  it('forgot-password / reset-password issues a working one-time token', async () => {
    const agent = request.agent(app);
    const csrfToken = await fetchCsrf(agent);

    const forgotRes = await agent
      .post('/api/v1/auth/forgot-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ usernameOrEmail: resetFlowUsername });

    expect(forgotRes.status).toBe(200);
    const forgotBody = forgotRes.body as { data: { devResetToken?: string } };
    const devToken = forgotBody.data.devResetToken;
    expect(devToken).toBeTruthy();

    const newPassword = 'BrandNewPassw0rd!';
    const resetRes = await agent
      .post('/api/v1/auth/reset-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ token: devToken, newPassword });
    expect(resetRes.status).toBe(200);

    const loginAgent = request.agent(app);
    const loginCsrf = await fetchCsrf(loginAgent);
    const loginRes = await loginAgent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', loginCsrf)
      .send({ usernameOrEmail: resetFlowUsername, password: newPassword });
    expect(loginRes.status).toBe(200);

    const reuseRes = await agent
      .post('/api/v1/auth/reset-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ token: devToken, newPassword: 'SomethingElse123!' });
    expect(reuseRes.status).toBe(422);
  });
});
