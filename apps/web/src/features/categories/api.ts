import type {
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@inventory-ms/contracts';
import { useCrudResource } from '@/lib/useCrudResource';

export function useCategories() {
  return useCrudResource<CategoryDto, CreateCategoryRequest, UpdateCategoryRequest>(
    'categories',
    '/api/v1/categories',
  );
}
