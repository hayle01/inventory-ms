import { useMutation } from '@tanstack/react-query';
import type { ForgotPasswordRequest } from '@inventory-ms/contracts';
import { apiRequest } from '../../lib/apiClient';

interface ForgotPasswordResponse {
  message: string;
  challengeId: string;
  /** Only present outside production -- see apps/api AuthService.forgotPassword. */
  devResetCode?: string;
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordRequest) =>
      apiRequest<ForgotPasswordResponse>('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: payload,
      }),
  });
}
