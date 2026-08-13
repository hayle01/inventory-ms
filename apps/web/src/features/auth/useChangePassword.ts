import { useMutation } from '@tanstack/react-query';
import type { ChangePasswordRequest } from '@inventory-ms/contracts';
import { apiRequest } from '../../lib/apiClient';

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordRequest) =>
      apiRequest<{ changed: true; csrfToken: string }>('/api/v1/me/password', {
        method: 'PATCH',
        body: payload,
      }),
  });
}
