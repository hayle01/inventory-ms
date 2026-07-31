import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateStorageLocationRequest,
  CreateWarehouseRequest,
  StorageLocationDto,
  UpdateStorageLocationRequest,
  UpdateWarehouseRequest,
  WarehouseDto,
} from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';
import { useCrudResource } from '@/lib/useCrudResource';

export function useWarehouses() {
  return useCrudResource<WarehouseDto, CreateWarehouseRequest, UpdateWarehouseRequest>(
    'warehouses',
    '/api/v1/warehouses',
  );
}

export function useStorageLocations(warehouseId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['warehouses', warehouseId, 'locations'];

  const list = useQuery({
    queryKey,
    queryFn: () =>
      apiRequest<StorageLocationDto[]>(`/api/v1/warehouses/${String(warehouseId)}/locations`),
    enabled: Boolean(warehouseId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const create = useMutation({
    mutationFn: (payload: CreateStorageLocationRequest) =>
      apiRequest<StorageLocationDto>(`/api/v1/warehouses/${String(warehouseId)}/locations`, {
        method: 'POST',
        body: payload,
      }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStorageLocationRequest }) =>
      apiRequest<StorageLocationDto>(`/api/v1/warehouses/${String(warehouseId)}/locations/${id}`, {
        method: 'PATCH',
        body: payload,
      }),
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      apiRequest<StorageLocationDto>(
        `/api/v1/warehouses/${String(warehouseId)}/locations/${id}/archive`,
        {
          method: 'POST',
        },
      ),
    onSuccess: invalidate,
  });

  return { list, create, update, archive };
}
