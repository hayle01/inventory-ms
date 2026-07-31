import { Types } from 'mongoose';
import type {
  CreateStorageLocationRequest,
  UpdateStorageLocationRequest,
} from '@inventory-ms/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { WarehouseModel } from '../models/Warehouse.js';
import { StorageLocationModel, type StorageLocationDoc } from '../models/StorageLocation.js';
import type { OrgActionContext } from './DepartmentService.js';

async function assertWarehouseInOrg(
  organizationId: Types.ObjectId,
  warehouseId: Types.ObjectId,
): Promise<void> {
  const warehouse = await WarehouseModel.findOne({ _id: warehouseId, organizationId }).lean();
  if (!warehouse) throw new NotFoundError('Warehouse not found.');
}

export async function listStorageLocations(
  organizationId: Types.ObjectId,
  warehouseId: Types.ObjectId,
): Promise<StorageLocationDoc[]> {
  await assertWarehouseInOrg(organizationId, warehouseId);
  return StorageLocationModel.find({ organizationId, warehouseId, status: { $ne: 'archived' } })
    .sort({ code: 1 })
    .lean();
}

export async function getStorageLocationById(
  organizationId: Types.ObjectId,
  warehouseId: Types.ObjectId,
  locationId: Types.ObjectId,
): Promise<StorageLocationDoc> {
  const location = await StorageLocationModel.findOne({
    _id: locationId,
    organizationId,
    warehouseId,
  }).lean();
  if (!location) throw new NotFoundError('Storage location not found.');
  return location;
}

export async function createStorageLocation(
  context: OrgActionContext,
  warehouseId: Types.ObjectId,
  input: CreateStorageLocationRequest,
): Promise<StorageLocationDoc> {
  await assertWarehouseInOrg(context.organizationId, warehouseId);

  const existing = await StorageLocationModel.findOne({ warehouseId, code: input.code }).lean();
  if (existing)
    throw new ConflictError('A location with this code already exists in this warehouse.');

  const location = await StorageLocationModel.create({
    organizationId: context.organizationId,
    warehouseId,
    code: input.code,
    name: input.name,
    locationType: input.locationType,
  });

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'locations.create',
    resourceType: 'storageLocation',
    resourceId: location._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return location.toObject();
}

export async function updateStorageLocation(
  context: OrgActionContext,
  warehouseId: Types.ObjectId,
  locationId: Types.ObjectId,
  input: UpdateStorageLocationRequest,
): Promise<StorageLocationDoc> {
  const location = await StorageLocationModel.findOne({
    _id: locationId,
    organizationId: context.organizationId,
    warehouseId,
  });
  if (!location) throw new NotFoundError('Storage location not found.');
  if (location.status === 'archived')
    throw new ValidationError('Archived locations cannot be modified.');

  const changedFields: Record<string, unknown> = {};
  if (input.name !== undefined) {
    changedFields['name'] = true;
    location.name = input.name;
  }
  if (input.locationType !== undefined) {
    changedFields['locationType'] = true;
    location.locationType = input.locationType;
  }

  await location.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'locations.update',
    resourceType: 'storageLocation',
    resourceId: location._id,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return location.toObject();
}

export async function archiveStorageLocation(
  context: OrgActionContext,
  warehouseId: Types.ObjectId,
  locationId: Types.ObjectId,
): Promise<StorageLocationDoc> {
  const location = await StorageLocationModel.findOne({
    _id: locationId,
    organizationId: context.organizationId,
    warehouseId,
  });
  if (!location) throw new NotFoundError('Storage location not found.');
  if (location.status === 'archived') throw new ValidationError('Location is already archived.');

  location.status = 'archived';
  await location.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'locations.archive',
    resourceType: 'storageLocation',
    resourceId: location._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return location.toObject();
}
