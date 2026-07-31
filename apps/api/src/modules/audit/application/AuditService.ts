import type { ClientSession, Types } from 'mongoose';
import { AuditEventModel } from '../models/AuditEvent.js';

export interface RecordAuditEventInput {
  organizationId: Types.ObjectId;
  actorId: Types.ObjectId | null;
  actorType?: 'user' | 'system';
  action: string;
  resourceType: string;
  resourceId?: Types.ObjectId | null;
  resourceNumber?: string | null;
  outcome: 'success' | 'denied' | 'failure';
  permissionUsed?: string | null;
  reason?: string | null;
  correlationId: string;
  ipHash?: string | null;
  userAgentSummary?: string | null;
  changedFields?: Record<string, unknown> | null;
}

/**
 * Writes an append-only audit event. Never include passwords, hashes,
 * tokens, cookies, MFA secrets, authorization headers, or full sensitive
 * payloads in `changedFields` -- only a safe summary of what changed.
 */
export async function recordAuditEvent(
  input: RecordAuditEventInput,
  session?: ClientSession,
): Promise<void> {
  await AuditEventModel.create(
    [
      {
        organizationId: input.organizationId,
        actorId: input.actorId,
        actorType: input.actorType ?? 'user',
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        resourceNumber: input.resourceNumber ?? null,
        outcome: input.outcome,
        permissionUsed: input.permissionUsed ?? null,
        reason: input.reason ?? null,
        correlationId: input.correlationId,
        ipHash: input.ipHash ?? null,
        userAgentSummary: input.userAgentSummary ?? null,
        changedFields: input.changedFields ?? null,
      },
    ],
    session ? { session } : {},
  );
}
