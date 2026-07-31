import { Types } from 'mongoose';
import type { CreateCategoryRequest, UpdateCategoryRequest } from '@inventory-ms/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import type { OrgActionContext } from '../../organization/application/DepartmentService.js';
import { CategoryModel, type CategoryDoc } from '../models/Category.js';

export async function listCategories(organizationId: Types.ObjectId): Promise<CategoryDoc[]> {
  return CategoryModel.find({ organizationId, status: { $ne: 'archived' } })
    .sort({ name: 1 })
    .lean();
}

export async function getCategoryById(
  organizationId: Types.ObjectId,
  categoryId: Types.ObjectId,
): Promise<CategoryDoc> {
  const category = await CategoryModel.findOne({ _id: categoryId, organizationId }).lean();
  if (!category) throw new NotFoundError('Category not found.');
  return category;
}

async function assertParentInOrg(
  organizationId: Types.ObjectId,
  parentId: string | null | undefined,
): Promise<Types.ObjectId | null> {
  if (!parentId) return null;
  const parentObjectId = new Types.ObjectId(parentId);
  const parent = await CategoryModel.findOne({ _id: parentObjectId, organizationId }).lean();
  if (!parent) throw new ValidationError('Parent category does not exist in this organization.');
  return parentObjectId;
}

export async function createCategory(
  context: OrgActionContext,
  input: CreateCategoryRequest,
): Promise<CategoryDoc> {
  const existing = await CategoryModel.findOne({
    organizationId: context.organizationId,
    code: input.code,
  }).lean();
  if (existing) throw new ConflictError('A category with this code already exists.');

  const parentId = await assertParentInOrg(context.organizationId, input.parentId);

  const category = await CategoryModel.create({
    organizationId: context.organizationId,
    parentId,
    code: input.code,
    name: input.name,
    description: input.description ?? null,
  });

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'categories.create',
    resourceType: 'category',
    resourceId: category._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return category.toObject();
}

export async function updateCategory(
  context: OrgActionContext,
  categoryId: Types.ObjectId,
  input: UpdateCategoryRequest,
): Promise<CategoryDoc> {
  const category = await CategoryModel.findOne({
    _id: categoryId,
    organizationId: context.organizationId,
  });
  if (!category) throw new NotFoundError('Category not found.');
  if (category.status === 'archived')
    throw new ValidationError('Archived categories cannot be modified.');

  const changedFields: Record<string, unknown> = {};
  if (input.name !== undefined) {
    changedFields['name'] = true;
    category.name = input.name;
  }
  if (input.description !== undefined) {
    changedFields['description'] = true;
    category.description = input.description;
  }
  if (input.parentId !== undefined) {
    if (input.parentId && new Types.ObjectId(input.parentId).equals(category._id)) {
      throw new ValidationError('A category cannot be its own parent.');
    }
    changedFields['parentId'] = true;
    category.parentId = await assertParentInOrg(context.organizationId, input.parentId);
  }

  await category.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'categories.update',
    resourceType: 'category',
    resourceId: category._id,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return category.toObject();
}

export async function archiveCategory(
  context: OrgActionContext,
  categoryId: Types.ObjectId,
): Promise<CategoryDoc> {
  const category = await CategoryModel.findOne({
    _id: categoryId,
    organizationId: context.organizationId,
  });
  if (!category) throw new NotFoundError('Category not found.');
  if (category.status === 'archived') throw new ValidationError('Category is already archived.');

  category.status = 'archived';
  await category.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'categories.archive',
    resourceType: 'category',
    resourceId: category._id,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return category.toObject();
}
