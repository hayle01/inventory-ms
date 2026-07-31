import type {
  CreateProductRequest,
  ProductDto,
  UpdateProductRequest,
} from '@inventory-ms/contracts';
import { useCrudResource } from '@/lib/useCrudResource';

export function useProducts() {
  return useCrudResource<ProductDto, CreateProductRequest, UpdateProductRequest>(
    'products',
    '/api/v1/products',
  );
}
