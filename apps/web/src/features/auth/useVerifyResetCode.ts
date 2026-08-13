import { useMutation } from '@tanstack/react-query';
import type { VerifyResetCodeRequest } from '@inventory-ms/contracts';
import { apiRequest } from '../../lib/apiClient';

interface VerifyResetCodeResponse {
  token: string;
}

export function useVerifyResetCode() {
  return useMutation({
    mutationFn: (payload: VerifyResetCodeRequest) =>
      apiRequest<VerifyResetCodeResponse>('/api/v1/auth/verify-reset-code', {
        method: 'POST',
        body: payload,
      }),
  });
}
