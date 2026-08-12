import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStockTransferRequest, StockTransferDto } from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/stock-transfers';

export function useStockTransfers(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['stock-transfers'],
    queryFn: () => apiRequest<StockTransferDto[]>(BASE_PATH),
    enabled: options.enabled ?? true,
  });
}

export function useStockTransfer(id: string | undefined) {
  return useQuery({
    queryKey: ['stock-transfers', id],
    queryFn: () => apiRequest<StockTransferDto>(`${BASE_PATH}/${String(id)}`),
    enabled: Boolean(id),
  });
}

function useInvalidateStockTransfers() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['stock-transfers', id] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export function useCreateStockTransfer() {
  const invalidate = useInvalidateStockTransfers();
  return useMutation({
    mutationFn: (payload: CreateStockTransferRequest) =>
      apiRequest<StockTransferDto>(BASE_PATH, { method: 'POST', body: payload }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useSubmitStockTransfer() {
  const invalidate = useInvalidateStockTransfers();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockTransferDto>(`${BASE_PATH}/${id}/submit`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useApproveStockTransfer() {
  const invalidate = useInvalidateStockTransfers();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockTransferDto>(`${BASE_PATH}/${id}/approve`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function usePostStockTransfer() {
  const invalidate = useInvalidateStockTransfers();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockTransferDto>(`${BASE_PATH}/${id}/post`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useReceiveStockTransfer() {
  const invalidate = useInvalidateStockTransfers();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockTransferDto>(`${BASE_PATH}/${id}/receive`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useReverseStockTransfer() {
  const invalidate = useInvalidateStockTransfers();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<StockTransferDto>(`${BASE_PATH}/${id}/reverse`, {
        method: 'POST',
        body: { reason },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}
