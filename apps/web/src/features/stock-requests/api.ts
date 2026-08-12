import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApproveStockRequestRequest,
  CreateStockRequestRequest,
  StockRequestDto,
  UpdateStockRequestRequest,
} from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/stock-requests';

export function useStockRequests(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['stock-requests'],
    queryFn: () => apiRequest<StockRequestDto[]>(BASE_PATH),
    enabled: options.enabled ?? true,
  });
}

export function useStockRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['stock-requests', id],
    queryFn: () => apiRequest<StockRequestDto>(`${BASE_PATH}/${String(id)}`),
    enabled: Boolean(id),
  });
}

function useInvalidateStockRequests() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['stock-requests', id] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export function useCreateStockRequest() {
  const invalidate = useInvalidateStockRequests();
  return useMutation({
    mutationFn: (payload: CreateStockRequestRequest) =>
      apiRequest<StockRequestDto>(BASE_PATH, { method: 'POST', body: payload }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useUpdateStockRequest() {
  const invalidate = useInvalidateStockRequests();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStockRequestRequest }) =>
      apiRequest<StockRequestDto>(`${BASE_PATH}/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

export function useSubmitStockRequest() {
  const invalidate = useInvalidateStockRequests();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockRequestDto>(`${BASE_PATH}/${id}/submit`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useApproveStockRequest() {
  const invalidate = useInvalidateStockRequests();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ApproveStockRequestRequest }) =>
      apiRequest<StockRequestDto>(`${BASE_PATH}/${id}/approve`, { method: 'POST', body: payload }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

export function useRejectStockRequest() {
  const invalidate = useInvalidateStockRequests();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<StockRequestDto>(`${BASE_PATH}/${id}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

export function useCancelStockRequest() {
  const invalidate = useInvalidateStockRequests();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<StockRequestDto>(`${BASE_PATH}/${id}/cancel`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}
