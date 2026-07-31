import type { Types } from 'mongoose';
import type { CreateUnitRequest, UpdateUnitRequest } from '@inventory-ms/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import type { OrgActionContext } from '../../organization/application/DepartmentService.js';
import { UnitModel, type UnitDoc } from '../models/Unit.js';

export async function listUnits(organizationId: Types.ObjectId): Promise<UnitDoc[]> {
  return UnitModel.find({ organizationId, status: { $ne: 'archived' } })
    .sort({ name: 1 })
    .lean();
}

export async function getUnitById(
  organizationId: Types.ObjectId,
  unitId: Types.ObjectId,
): Promise<UnitDoc> {
  const unit = await UnitModel.findOne({ _id: unitId, organizationId }).lean();
  if (!unit) throw new NotFoundError('Unit not found.');
  return unit;
}

export async function createUnit(
  context: OrgActionContext,
  input: CreateUnitRequest,
): Promise<UnitDoc> {
  const existing = await UnitModel.findOne({
    organizationId: context.organizationId,
    code: input.code,
  }).lean();
  if (existing) throw new ConflictError('A unit with this code already exists.');

  const unit = await UnitModel.create({
    organizationId: context.organizationId,
    code: input.code,
    name: input.name,
    symbol: input.symbol,
    decimalPlaces: input.decimalPlaces,
  });

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'units.create',
    resourceType: 'unit',
    resourceId: unit._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return unit.toObject();
}

export async function updateUnit(
  context: OrgActionContext,
  unitId: Types.ObjectId,
  input: UpdateUnitRequest,
): Promise<UnitDoc> {
  const unit = await UnitModel.findOne({ _id: unitId, organizationId: context.organizationId });
  if (!unit) throw new NotFoundError('Unit not found.');
  if (unit.status === 'archived') throw new ValidationError('Archived units cannot be modified.');

  const changedFields: Record<string, unknown> = {};
  if (input.name !== undefined) {
    changedFields['name'] = true;
    unit.name = input.name;
  }
  if (input.symbol !== undefined) {
    changedFields['symbol'] = true;
    unit.symbol = input.symbol;
  }
  if (input.decimalPlaces !== undefined) {
    changedFields['decimalPlaces'] = true;
    unit.decimalPlaces = input.decimalPlaces;
  }

  await unit.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'units.update',
    resourceType: 'unit',
    resourceId: unit._id,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return unit.toObject();
}

export async function archiveUnit(
  context: OrgActionContext,
  unitId: Types.ObjectId,
): Promise<UnitDoc> {
  const unit = await UnitModel.findOne({ _id: unitId, organizationId: context.organizationId });
  if (!unit) throw new NotFoundError('Unit not found.');
  if (unit.status === 'archived') throw new ValidationError('Unit is already archived.');

  unit.status = 'archived';
  await unit.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'units.archive',
    resourceType: 'unit',
    resourceId: unit._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return unit.toObject();
}
