import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionDto } from '@inventory-ms/contracts';
import { apiRequest } from '../../lib/apiClient';

export function useSessions() {
  return useQuery({
    queryKey: ['me', 'sessions'],
    queryFn: () => apiRequest<SessionDto[]>('/api/v1/me/sessions'),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest<{ revoked: boolean }>(`/api/v1/me/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'sessions'] }),
  });
}

export function useLogoutAllSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ loggedOut: boolean }>('/api/v1/auth/logout-all', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.setQueryData(['me'], undefined);
      queryClient.clear();
    },
  });
}
