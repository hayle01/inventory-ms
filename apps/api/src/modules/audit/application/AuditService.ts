import type { ClientSession, Types } from 'mongoose';
import type { AuditEventsQuery } from '@inventory-ms/contracts';
import { AuditEventModel, type AuditEventDoc } from '../models/AuditEvent.js';

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

export async function listAuditEvents(
  organizationId: Types.ObjectId,
  query: AuditEventsQuery,
): Promise<{ items: AuditEventDoc[]; total: number }> {
  const filter: Record<string, unknown> = { organizationId };
  if (query.resourceType) filter['resourceType'] = query.resourceType;
  if (query.action) filter['action'] = query.action;
  if (query.actorId) filter['actorId'] = query.actorId;
  if (query.outcome) filter['outcome'] = query.outcome;
  if (query.dateFrom ?? query.dateTo) {
    filter['createdAt'] = {
      ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { $lte: new Date(query.dateTo) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    AuditEventModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .lean(),
    AuditEventModel.countDocuments(filter),
  ]);

  return { items, total };
}
