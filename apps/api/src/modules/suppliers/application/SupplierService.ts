import type { Types } from 'mongoose';
import type { CreateSupplierRequest, UpdateSupplierRequest } from '@inventory-ms/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import type { OrgActionContext } from '../../organization/application/DepartmentService.js';
import { SupplierModel, type SupplierDoc } from '../models/Supplier.js';

export async function listSuppliers(organizationId: Types.ObjectId): Promise<SupplierDoc[]> {
  return SupplierModel.find({ organizationId, status: { $ne: 'archived' } })
    .sort({ name: 1 })
    .lean();
}

export async function getSupplierById(
  organizationId: Types.ObjectId,
  supplierId: Types.ObjectId,
): Promise<SupplierDoc> {
  const supplier = await SupplierModel.findOne({ _id: supplierId, organizationId }).lean();
  if (!supplier) throw new NotFoundError('Supplier not found.');
  return supplier;
}

export async function createSupplier(
  context: OrgActionContext,
  input: CreateSupplierRequest,
): Promise<SupplierDoc> {
  const existing = await SupplierModel.findOne({
    organizationId: context.organizationId,
    code: input.code,
  }).lean();
  if (existing) throw new ConflictError('A supplier with this code already exists.');

  const supplier = await SupplierModel.create({
    organizationId: context.organizationId,
    code: input.code,
    name: input.name,
    addressLine: input.addressLine ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    taxIdentifier: input.taxIdentifier ?? null,
    notes: input.notes ?? null,
  });

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'suppliers.create',
    resourceType: 'supplier',
    resourceId: supplier._id,
    resourceNumber: supplier.code,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return supplier.toObject();
}

export async function updateSupplier(
  context: OrgActionContext,
  supplierId: Types.ObjectId,
  input: UpdateSupplierRequest,
): Promise<SupplierDoc> {
  const supplier = await SupplierModel.findOne({
    _id: supplierId,
    organizationId: context.organizationId,
  });
  if (!supplier) throw new NotFoundError('Supplier not found.');
  if (supplier.status === 'archived')
    throw new ValidationError('Archived suppliers cannot be modified.');

  const changedFields: Record<string, unknown> = {};
  if (input.name !== undefined) {
    changedFields['name'] = true;
    supplier.name = input.name;
  }
  if (input.addressLine !== undefined) {
    changedFields['addressLine'] = true;
    supplier.addressLine = input.addressLine;
  }
  if (input.phone !== undefined) {
    changedFields['phone'] = true;
    supplier.phone = input.phone;
  }
  if (input.email !== undefined) {
    changedFields['email'] = true;
    supplier.email = input.email;
  }
  if (input.taxIdentifier !== undefined) {
    changedFields['taxIdentifier'] = true;
    supplier.taxIdentifier = input.taxIdentifier;
  }
  if (input.notes !== undefined) {
    changedFields['notes'] = true;
    supplier.notes = input.notes;
  }

  await supplier.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'suppliers.update',
    resourceType: 'supplier',
    resourceId: supplier._id,
    resourceNumber: supplier.code,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return supplier.toObject();
}

export async function archiveSupplier(
  context: OrgActionContext,
  supplierId: Types.ObjectId,
): Promise<SupplierDoc> {
  const supplier = await SupplierModel.findOne({
    _id: supplierId,
    organizationId: context.organizationId,
  });
  if (!supplier) throw new NotFoundError('Supplier not found.');
  if (supplier.status === 'archived') throw new ValidationError('Supplier is already archived.');

  supplier.status = 'archived';
  await supplier.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'suppliers.archive',
    resourceType: 'supplier',
    resourceId: supplier._id,
    resourceNumber: supplier.code,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return supplier.toObject();
}
