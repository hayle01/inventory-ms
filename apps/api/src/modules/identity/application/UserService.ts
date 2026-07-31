import { randomBytes, createHash } from 'node:crypto';
import { Types } from 'mongoose';
import type { CreateUserRequest, UpdateUserRequest } from '@inventory-ms/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { enqueueNotification } from '../../../shared/infrastructure/queue.js';
import { RoleModel } from '../../access/models/Role.js';
import { UserModel, type UserDoc } from '../models/User.js';
import { PasswordResetTokenModel } from '../models/PasswordResetToken.js';
import { hashPassword } from '../domain/password.js';
import { assertUserStatusTransition } from '../domain/userStatus.js';
import { revokeAllSessions } from './SessionService.js';

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function assertRolesBelongToOrg(
  organizationId: Types.ObjectId,
  roleIds: readonly string[],
): Promise<void> {
  if (roleIds.length === 0) return;
  const count = await RoleModel.countDocuments({
    _id: { $in: roleIds },
    organizationId,
    archivedAt: null,
  });
  if (count !== roleIds.length) {
    throw new ValidationError('One or more roles do not exist in this organization.');
  }
}

export async function listUsers(organizationId: Types.ObjectId): Promise<UserDoc[]> {
  return UserModel.find({ organizationId, archivedAt: null }).sort({ fullName: 1 }).lean();
}

export async function getUserById(
  organizationId: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<UserDoc> {
  const user = await UserModel.findOne({ _id: userId, organizationId, archivedAt: null }).lean();
  if (!user) throw new NotFoundError('User not found.');
  return user;
}

export interface CreateUserContext {
  organizationId: Types.ObjectId;
  actorId: Types.ObjectId;
  correlationId: string;
}

export async function createUser(
  context: CreateUserContext,
  input: CreateUserRequest,
): Promise<UserDoc> {
  await assertRolesBelongToOrg(context.organizationId, input.roleIds);

  const existing = await UserModel.findOne({
    organizationId: context.organizationId,
    $or: [{ usernameNormalized: input.username }, { emailNormalized: input.email }],
  }).lean();
  if (existing) throw new ConflictError('A user with this username or email already exists.');

  const temporaryPasswordHash = await hashPassword(randomBytes(32).toString('hex'));

  const user = await UserModel.create({
    organizationId: context.organizationId,
    fullName: input.fullName,
    usernameNormalized: input.username,
    emailNormalized: input.email,
    passwordHash: temporaryPasswordHash,
    status: 'invited',
    departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : null,
    warehouseScopeIds: (input.warehouseScopeIds ?? []).map((id) => new Types.ObjectId(id)),
    roleIds: input.roleIds.map((id) => new Types.ObjectId(id)),
    createdBy: context.actorId,
    updatedBy: context.actorId,
  });

  const rawToken = randomBytes(32).toString('hex');
  await PasswordResetTokenModel.create({
    userId: user._id,
    tokenHash: createHash('sha256').update(rawToken).digest('hex'),
    expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
  });
  await enqueueNotification({
    template: 'user-invite',
    toUserId: user._id.toString(),
    data: { resetToken: rawToken },
  });

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'users.create',
    resourceType: 'user',
    resourceId: user._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return user.toObject();
}

export async function updateUser(
  context: CreateUserContext,
  userId: Types.ObjectId,
  input: UpdateUserRequest,
): Promise<UserDoc> {
  const user = await UserModel.findOne({
    _id: userId,
    organizationId: context.organizationId,
    archivedAt: null,
  });
  if (!user) throw new NotFoundError('User not found.');
  if (input.roleIds) await assertRolesBelongToOrg(context.organizationId, input.roleIds);

  const changedFields: Record<string, unknown> = {};
  if (input.fullName !== undefined && input.fullName !== user.fullName) {
    changedFields['fullName'] = true;
    user.fullName = input.fullName;
  }
  if (input.departmentId !== undefined) {
    changedFields['departmentId'] = true;
    user.departmentId = input.departmentId ? new Types.ObjectId(input.departmentId) : null;
  }
  if (input.warehouseScopeIds !== undefined) {
    changedFields['warehouseScopeIds'] = true;
    user.warehouseScopeIds = input.warehouseScopeIds.map((id) => new Types.ObjectId(id));
  }
  if (input.roleIds !== undefined) {
    changedFields['roleIds'] = true;
    user.roleIds = input.roleIds.map((id) => new Types.ObjectId(id));
  }
  user.updatedBy = context.actorId;

  await user.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'users.update',
    resourceType: 'user',
    resourceId: user._id,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return user.toObject();
}

async function transitionStatus(
  context: CreateUserContext,
  userId: Types.ObjectId,
  toStatus: 'active' | 'inactive' | 'archived',
  action: string,
  reason?: string,
): Promise<UserDoc> {
  const user = await UserModel.findOne({ _id: userId, organizationId: context.organizationId });
  if (!user) throw new NotFoundError('User not found.');

  assertUserStatusTransition(user.status, toStatus);
  user.status = toStatus;
  user.updatedBy = context.actorId;
  if (toStatus === 'archived') user.archivedAt = new Date();
  await user.save();

  if (toStatus !== 'active') {
    await revokeAllSessions(user._id, action);
  }

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action,
    resourceType: 'user',
    resourceId: user._id,
    outcome: 'success',
    reason: reason ?? null,
    correlationId: context.correlationId,
  });

  return user.toObject();
}

export async function activateUser(
  context: CreateUserContext,
  userId: Types.ObjectId,
): Promise<UserDoc> {
  return transitionStatus(context, userId, 'active', 'users.activate');
}

export async function deactivateUser(
  context: CreateUserContext,
  userId: Types.ObjectId,
  reason?: string,
): Promise<UserDoc> {
  return transitionStatus(context, userId, 'inactive', 'users.deactivate', reason);
}

export async function archiveUser(
  context: CreateUserContext,
  userId: Types.ObjectId,
  reason?: string,
): Promise<UserDoc> {
  return transitionStatus(context, userId, 'archived', 'users.archive', reason);
}
