import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/apiClient';

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiRequest<{ loggedOut: boolean }>('/api/v1/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(['me'], undefined);
      queryClient.clear();
    },
  });
}
