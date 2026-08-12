import type { AuditEventDto } from '@inventory-ms/contracts';
import type { AuditEventDoc } from '../models/AuditEvent.js';

export function toAuditEventDto(event: AuditEventDoc): AuditEventDto {
  return {
    id: event._id.toString(),
    organizationId: event.organizationId.toString(),
    actorId: event.actorId ? event.actorId.toString() : null,
    actorType: event.actorType,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId ? event.resourceId.toString() : null,
    resourceNumber: event.resourceNumber ?? null,
    outcome: event.outcome,
    permissionUsed: event.permissionUsed ?? null,
    reason: event.reason ?? null,
    correlationId: event.correlationId,
    changedFields: (event.changedFields as Record<string, unknown> | null) ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}
