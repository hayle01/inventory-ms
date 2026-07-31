import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrganizationDto, UpdateOrganizationRequest } from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/organization';

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: () => apiRequest<OrganizationDto>(BASE_PATH),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOrganizationRequest) =>
      apiRequest<OrganizationDto>(BASE_PATH, { method: 'PATCH', body: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organization'] }),
  });
}
