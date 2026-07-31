import { useQuery } from '@tanstack/react-query';
import type { MeResponse } from '@inventory-ms/contracts';
import { apiRequest } from '../../lib/apiClient';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<MeResponse>('/api/v1/me'),
    retry: false,
  });
}
