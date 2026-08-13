import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRoleRequest, RoleDto, UpdateRoleRequest } from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/roles';

export function useRoles(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => apiRequest<RoleDto[]>(BASE_PATH),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoleRequest) =>
      apiRequest<RoleDto>(BASE_PATH, { method: 'POST', body: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRoleRequest }) =>
      apiRequest<RoleDto>(`${BASE_PATH}/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}
