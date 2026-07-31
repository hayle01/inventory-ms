import { useQuery } from '@tanstack/react-query';
import type { PermissionDto } from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

export function usePermissionCatalog() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => apiRequest<PermissionDto[]>('/api/v1/permissions'),
  });
}
