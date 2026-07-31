import { z } from 'zod';
import { PERMISSIONS } from '../permissions.js';

export const USER_STATUSES = ['invited', 'active', 'locked', 'inactive', 'archived'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const usernamePattern = /^[a-z0-9._-]{3,64}$/;

export const loginRequestSchema = z.object({
  usernameOrEmail: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(512),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const mfaVerifyRequestSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().trim().min(6).max(64),
});
export type MfaVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;

export const forgotPasswordRequestSchema = z.object({
  usernameOrEmail: z.string().trim().min(3).max(254),
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(12).max(256),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(512),
  newPassword: z.string().min(12).max(256),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const permissionDtoSchema = z.object({
  name: z.enum(PERMISSIONS),
  description: z.string(),
  module: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
});
export type PermissionDto = z.infer<typeof permissionDtoSchema>;

export const roleDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  permissionNames: z.array(z.enum(PERMISSIONS)),
  isSystem: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});
export type RoleDto = z.infer<typeof roleDtoSchema>;

/** Only fields a client is ever allowed to submit -- status/audit fields are server-owned. */
export const createRoleRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  permissionNames: z.array(z.enum(PERMISSIONS)).min(1).max(PERMISSIONS.length),
});
export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;

export const updateRoleRequestSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  permissionNames: z.array(z.enum(PERMISSIONS)).min(1).max(PERMISSIONS.length).optional(),
});
export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;

export const userDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  fullName: z.string(),
  username: z.string(),
  email: z.string(),
  status: z.enum(USER_STATUSES),
  departmentId: z.string().nullable(),
  warehouseScopeIds: z.array(z.string()),
  roleIds: z.array(z.string()),
  directPermissionNames: z.array(z.enum(PERMISSIONS)),
  mfaEnabled: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const createUserRequestSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  username: z.string().trim().toLowerCase().regex(usernamePattern),
  email: z.string().trim().toLowerCase().email().max(254),
  departmentId: z.string().nullable().optional(),
  warehouseScopeIds: z.array(z.string()).max(50).optional(),
  roleIds: z.array(z.string()).max(20).default([]),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

/**
 * Generic update DTO. Deliberately excludes `status`, `passwordHash`,
 * `failedLoginCount`, `lockedUntil`, `organizationId`, and any audit field --
 * those change only through dedicated, permission-checked endpoints/services.
 */
export const updateUserRequestSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  departmentId: z.string().nullable().optional(),
  warehouseScopeIds: z.array(z.string()).max(50).optional(),
  roleIds: z.array(z.string()).max(20).optional(),
});
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const meResponseSchema = z.object({
  user: userDtoSchema,
  permissions: z.array(z.enum(PERMISSIONS)),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const sessionDtoSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  expiresAt: z.string(),
  isCurrent: z.boolean(),
  userAgentSummary: z.string().nullable(),
});
export type SessionDto = z.infer<typeof sessionDtoSchema>;
