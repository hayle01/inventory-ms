import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateStockCountRequest,
  StockCountDto,
  UpdateStockCountRequest,
} from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/stock-counts';

export function useStockCounts(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['stock-counts'],
    queryFn: () => apiRequest<StockCountDto[]>(BASE_PATH),
    enabled: options.enabled ?? true,
  });
}

export function useStockCount(id: string | undefined) {
  return useQuery({
    queryKey: ['stock-counts', id],
    queryFn: () => apiRequest<StockCountDto>(`${BASE_PATH}/${String(id)}`),
    enabled: Boolean(id),
  });
}

function useInvalidateStockCounts() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['stock-counts', id] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export function useCreateStockCount() {
  const invalidate = useInvalidateStockCounts();
  return useMutation({
    mutationFn: (payload: CreateStockCountRequest) =>
      apiRequest<StockCountDto>(BASE_PATH, { method: 'POST', body: payload }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useUpdateStockCount() {
  const invalidate = useInvalidateStockCounts();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStockCountRequest }) =>
      apiRequest<StockCountDto>(`${BASE_PATH}/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

export function useSubmitStockCount() {
  const invalidate = useInvalidateStockCounts();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockCountDto>(`${BASE_PATH}/${id}/submit`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useApproveStockCount() {
  const invalidate = useInvalidateStockCounts();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockCountDto>(`${BASE_PATH}/${id}/approve`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useRejectStockCount() {
  const invalidate = useInvalidateStockCounts();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<StockCountDto>(`${BASE_PATH}/${id}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

export function usePostStockCount() {
  const invalidate = useInvalidateStockCounts();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockCountDto>(`${BASE_PATH}/${id}/post`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useReverseStockCount() {
  const invalidate = useInvalidateStockCounts();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<StockCountDto>(`${BASE_PATH}/${id}/reverse`, {
        method: 'POST',
        body: { reason },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}
