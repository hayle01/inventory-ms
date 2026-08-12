import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateStockAdjustmentRequest,
  StockAdjustmentDto,
  UpdateStockAdjustmentRequest,
} from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/stock-adjustments';

export function useStockAdjustments(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['stock-adjustments'],
    queryFn: () => apiRequest<StockAdjustmentDto[]>(BASE_PATH),
    enabled: options.enabled ?? true,
  });
}

export function useStockAdjustment(id: string | undefined) {
  return useQuery({
    queryKey: ['stock-adjustments', id],
    queryFn: () => apiRequest<StockAdjustmentDto>(`${BASE_PATH}/${String(id)}`),
    enabled: Boolean(id),
  });
}

function useInvalidateStockAdjustments() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['stock-adjustments', id] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export function useCreateStockAdjustment() {
  const invalidate = useInvalidateStockAdjustments();
  return useMutation({
    mutationFn: (payload: CreateStockAdjustmentRequest) =>
      apiRequest<StockAdjustmentDto>(BASE_PATH, { method: 'POST', body: payload }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useUpdateStockAdjustment() {
  const invalidate = useInvalidateStockAdjustments();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStockAdjustmentRequest }) =>
      apiRequest<StockAdjustmentDto>(`${BASE_PATH}/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

export function useSubmitStockAdjustment() {
  const invalidate = useInvalidateStockAdjustments();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockAdjustmentDto>(`${BASE_PATH}/${id}/submit`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useApproveStockAdjustment() {
  const invalidate = useInvalidateStockAdjustments();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockAdjustmentDto>(`${BASE_PATH}/${id}/approve`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useRejectStockAdjustment() {
  const invalidate = useInvalidateStockAdjustments();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<StockAdjustmentDto>(`${BASE_PATH}/${id}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

export function usePostStockAdjustment() {
  const invalidate = useInvalidateStockAdjustments();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockAdjustmentDto>(`${BASE_PATH}/${id}/post`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useReverseStockAdjustment() {
  const invalidate = useInvalidateStockAdjustments();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<StockAdjustmentDto>(`${BASE_PATH}/${id}/reverse`, {
        method: 'POST',
        body: { reason },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}
