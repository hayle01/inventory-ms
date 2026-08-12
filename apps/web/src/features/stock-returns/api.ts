import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStockReturnRequest, StockReturnDto } from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/returns';

export function useStockReturns() {
  return useQuery({
    queryKey: ['stock-returns'],
    queryFn: () => apiRequest<StockReturnDto[]>(BASE_PATH),
  });
}

export function useStockReturn(id: string | undefined) {
  return useQuery({
    queryKey: ['stock-returns', id],
    queryFn: () => apiRequest<StockReturnDto>(`${BASE_PATH}/${String(id)}`),
    enabled: Boolean(id),
  });
}

function useInvalidateStockReturns() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['stock-returns'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['stock-returns', id] });
    void queryClient.invalidateQueries({ queryKey: ['stock-issues'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export function useCreateStockReturn() {
  const invalidate = useInvalidateStockReturns();
  return useMutation({
    mutationFn: (payload: CreateStockReturnRequest) =>
      apiRequest<StockReturnDto>(BASE_PATH, { method: 'POST', body: payload }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function usePostStockReturn() {
  const invalidate = useInvalidateStockReturns();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockReturnDto>(`${BASE_PATH}/${id}/post`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}
