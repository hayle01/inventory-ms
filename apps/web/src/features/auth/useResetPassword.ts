import { useMutation } from '@tanstack/react-query';
import type { ResetPasswordRequest } from '@inventory-ms/contracts';
import { apiRequest } from '../../lib/apiClient';

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordRequest) =>
      apiRequest<{ reset: true }>('/api/v1/auth/reset-password', {
        method: 'POST',
        body: payload,
      }),
  });
}
