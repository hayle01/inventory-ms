import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserRequest, UpdateUserRequest, UserDto } from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/users';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiRequest<UserDto[]>(BASE_PATH),
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['users'] });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (payload: CreateUserRequest) =>
      apiRequest<UserDto>(BASE_PATH, { method: 'POST', body: payload }),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserRequest }) =>
      apiRequest<UserDto>(`${BASE_PATH}/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: invalidate,
  });
}

export function useActivateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => apiRequest<UserDto>(`${BASE_PATH}/${id}/activate`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useDeactivateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string | undefined }) =>
      apiRequest<UserDto>(`${BASE_PATH}/${id}/deactivate`, { method: 'POST', body: { reason } }),
    onSuccess: invalidate,
  });
}

export function useArchiveUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string | undefined }) =>
      apiRequest<UserDto>(`${BASE_PATH}/${id}/archive`, { method: 'POST', body: { reason } }),
    onSuccess: invalidate,
  });
}
