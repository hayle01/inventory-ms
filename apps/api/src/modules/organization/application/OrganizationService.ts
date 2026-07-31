import type { Types } from 'mongoose';
import type { UpdateOrganizationRequest } from '@inventory-ms/contracts';
import { NotFoundError } from '../../../shared/http/errors.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { Organization, type OrganizationDoc } from '../models/Organization.js';

export async function getOrganization(organizationId: Types.ObjectId): Promise<OrganizationDoc> {
  const org = await Organization.findById(organizationId).lean();
  if (!org) throw new NotFoundError('Organization not found.');
  return org;
}

export async function updateOrganization(
  organizationId: Types.ObjectId,
  actorId: Types.ObjectId,
  correlationId: string,
  input: UpdateOrganizationRequest,
): Promise<OrganizationDoc> {
  const org = await Organization.findById(organizationId);
  if (!org) throw new NotFoundError('Organization not found.');

  const changedFields: Record<string, unknown> = {};
  if (input.name !== undefined) {
    changedFields['name'] = true;
    org.name = input.name;
  }
  if (input.timezone !== undefined) {
    changedFields['timezone'] = true;
    org.timezone = input.timezone;
  }
  if (input.currencyCode !== undefined) {
    changedFields['currencyCode'] = true;
    org.currencyCode = input.currencyCode;
  }

  await org.save();

  await recordAuditEvent({
    organizationId,
    actorId,
    action: 'organizations.update',
    resourceType: 'organization',
    resourceId: organizationId,
    outcome: 'success',
    correlationId,
    changedFields,
  });

  return org.toObject();
}
