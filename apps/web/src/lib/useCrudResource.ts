import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './apiClient';

/**
 * Generic list + create + update + archive resource, shared by the
 * reference-data modules (departments, warehouses, categories, units,
 * suppliers, ...) that all follow the same
 * `GET /`, `POST /`, `PATCH /:id`, `POST /:id/archive` REST shape.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TUpdate is part of this hook's public generic contract, even though it currently appears once per call site.
export function useCrudResource<TDto extends { id: string }, TCreate, TUpdate>(
  queryKey: string,
  basePath: string,
) {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: [queryKey],
    queryFn: () => apiRequest<TDto[]>(basePath),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });

  const create = useMutation({
    mutationFn: (payload: TCreate) => apiRequest<TDto>(basePath, { method: 'POST', body: payload }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TUpdate }) =>
      apiRequest<TDto>(`${basePath}/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: (id: string) => apiRequest<TDto>(`${basePath}/${id}/archive`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  return { list, create, update, archive };
}
