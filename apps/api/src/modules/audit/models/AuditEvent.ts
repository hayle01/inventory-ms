import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const auditEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, default: null },
    actorType: { type: String, required: true, enum: ['user', 'system'], default: 'user' },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId, default: null },
    resourceNumber: { type: String, default: null },
    outcome: { type: String, required: true, enum: ['success', 'denied', 'failure'] },
    permissionUsed: { type: String, default: null },
    reason: { type: String, default: null },
    correlationId: { type: String, required: true },
    ipHash: { type: String, default: null },
    userAgentSummary: { type: String, default: null },
    changedFields: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: 'auditEvents' },
);

auditEventSchema.index({ organizationId: 1, createdAt: -1 });
auditEventSchema.index({ organizationId: 1, resourceType: 1, resourceId: 1 });

export type AuditEventDoc = InferSchemaType<typeof auditEventSchema> & { _id: Types.ObjectId };

export const AuditEventModel: Model<AuditEventDoc> = model<AuditEventDoc>(
  'AuditEvent',
  auditEventSchema,
);

registerModel('AuditEvent', AuditEventModel);
