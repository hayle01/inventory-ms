import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, MeResponse } from '@inventory-ms/contracts';
import { apiRequest } from '../../lib/apiClient';

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginRequest) =>
      apiRequest<MeResponse>('/api/v1/auth/login', { method: 'POST', body: payload }),
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data);
    },
  });
}
