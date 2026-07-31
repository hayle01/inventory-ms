import { Types } from 'mongoose';
import type { CreateWarehouseRequest, UpdateWarehouseRequest } from '@inventory-ms/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { WarehouseModel, type WarehouseDoc } from '../models/Warehouse.js';
import type { OrgActionContext } from './DepartmentService.js';

async function clearOtherDefaults(
  organizationId: Types.ObjectId,
  keepId: Types.ObjectId,
): Promise<void> {
  await WarehouseModel.updateMany(
    { organizationId, _id: { $ne: keepId }, isDefault: true },
    { $set: { isDefault: false } },
  );
}

export async function listWarehouses(organizationId: Types.ObjectId): Promise<WarehouseDoc[]> {
  return WarehouseModel.find({ organizationId, status: { $ne: 'archived' } })
    .sort({ name: 1 })
    .lean();
}

export async function getWarehouseById(
  organizationId: Types.ObjectId,
  warehouseId: Types.ObjectId,
): Promise<WarehouseDoc> {
  const warehouse = await WarehouseModel.findOne({ _id: warehouseId, organizationId }).lean();
  if (!warehouse) throw new NotFoundError('Warehouse not found.');
  return warehouse;
}

export async function createWarehouse(
  context: OrgActionContext,
  input: CreateWarehouseRequest,
): Promise<WarehouseDoc> {
  const existing = await WarehouseModel.findOne({
    organizationId: context.organizationId,
    code: input.code,
  }).lean();
  if (existing) throw new ConflictError('A warehouse with this code already exists.');

  const warehouse = await WarehouseModel.create({
    organizationId: context.organizationId,
    code: input.code,
    name: input.name,
    address: input.address ?? null,
    isDefault: input.isDefault ?? false,
  });

  if (warehouse.isDefault) {
    await clearOtherDefaults(context.organizationId, warehouse._id);
  }

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'warehouses.create',
    resourceType: 'warehouse',
    resourceId: warehouse._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return warehouse.toObject();
}

export async function updateWarehouse(
  context: OrgActionContext,
  warehouseId: Types.ObjectId,
  input: UpdateWarehouseRequest,
): Promise<WarehouseDoc> {
  const warehouse = await WarehouseModel.findOne({
    _id: warehouseId,
    organizationId: context.organizationId,
  });
  if (!warehouse) throw new NotFoundError('Warehouse not found.');
  if (warehouse.status === 'archived')
    throw new ValidationError('Archived warehouses cannot be modified.');

  const changedFields: Record<string, unknown> = {};
  if (input.name !== undefined) {
    changedFields['name'] = true;
    warehouse.name = input.name;
  }
  if (input.address !== undefined) {
    changedFields['address'] = true;
    warehouse.address = input.address;
  }
  if (input.isDefault !== undefined) {
    changedFields['isDefault'] = true;
    warehouse.isDefault = input.isDefault;
  }

  await warehouse.save();
  if (warehouse.isDefault) {
    await clearOtherDefaults(context.organizationId, warehouse._id);
  }

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'warehouses.update',
    resourceType: 'warehouse',
    resourceId: warehouse._id,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return warehouse.toObject();
}

export async function archiveWarehouse(
  context: OrgActionContext,
  warehouseId: Types.ObjectId,
): Promise<WarehouseDoc> {
  const warehouse = await WarehouseModel.findOne({
    _id: warehouseId,
    organizationId: context.organizationId,
  });
  if (!warehouse) throw new NotFoundError('Warehouse not found.');
  if (warehouse.status === 'archived') throw new ValidationError('Warehouse is already archived.');

  warehouse.status = 'archived';
  warehouse.isDefault = false;
  await warehouse.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'warehouses.archive',
    resourceType: 'warehouse',
    resourceId: warehouse._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return warehouse.toObject();
}
