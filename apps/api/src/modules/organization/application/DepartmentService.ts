import { Types } from 'mongoose';
import type { CreateDepartmentRequest, UpdateDepartmentRequest } from '@inventory-ms/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { DepartmentModel, type DepartmentDoc } from '../models/Department.js';

export interface OrgActionContext {
  organizationId: Types.ObjectId;
  actorId: Types.ObjectId;
  correlationId: string;
}

export async function listDepartments(organizationId: Types.ObjectId): Promise<DepartmentDoc[]> {
  return DepartmentModel.find({ organizationId, status: { $ne: 'archived' } })
    .sort({ name: 1 })
    .lean();
}

export async function getDepartmentById(
  organizationId: Types.ObjectId,
  departmentId: Types.ObjectId,
): Promise<DepartmentDoc> {
  const department = await DepartmentModel.findOne({ _id: departmentId, organizationId }).lean();
  if (!department) throw new NotFoundError('Department not found.');
  return department;
}

export async function createDepartment(
  context: OrgActionContext,
  input: CreateDepartmentRequest,
): Promise<DepartmentDoc> {
  const existing = await DepartmentModel.findOne({
    organizationId: context.organizationId,
    code: input.code,
  }).lean();
  if (existing) throw new ConflictError('A department with this code already exists.');

  const department = await DepartmentModel.create({
    organizationId: context.organizationId,
    code: input.code,
    name: input.name,
    managerUserId: input.managerUserId ? new Types.ObjectId(input.managerUserId) : null,
  });

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'departments.create',
    resourceType: 'department',
    resourceId: department._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return department.toObject();
}

export async function updateDepartment(
  context: OrgActionContext,
  departmentId: Types.ObjectId,
  input: UpdateDepartmentRequest,
): Promise<DepartmentDoc> {
  const department = await DepartmentModel.findOne({
    _id: departmentId,
    organizationId: context.organizationId,
  });
  if (!department) throw new NotFoundError('Department not found.');
  if (department.status === 'archived') {
    throw new ValidationError('Archived departments cannot be modified.');
  }

  const changedFields: Record<string, unknown> = {};
  if (input.name !== undefined) {
    changedFields['name'] = true;
    department.name = input.name;
  }
  if (input.managerUserId !== undefined) {
    changedFields['managerUserId'] = true;
    department.managerUserId = input.managerUserId ? new Types.ObjectId(input.managerUserId) : null;
  }

  await department.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'departments.update',
    resourceType: 'department',
    resourceId: department._id,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return department.toObject();
}

export async function archiveDepartment(
  context: OrgActionContext,
  departmentId: Types.ObjectId,
): Promise<DepartmentDoc> {
  const department = await DepartmentModel.findOne({
    _id: departmentId,
    organizationId: context.organizationId,
  });
  if (!department) throw new NotFoundError('Department not found.');
  if (department.status === 'archived')
    throw new ValidationError('Department is already archived.');

  department.status = 'archived';
  await department.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'departments.archive',
    resourceType: 'department',
    resourceId: department._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return department.toObject();
}
