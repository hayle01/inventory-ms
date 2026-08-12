import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStockIssueRequest, StockIssueDto } from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/issues';

export function useStockIssues() {
  return useQuery({
    queryKey: ['stock-issues'],
    queryFn: () => apiRequest<StockIssueDto[]>(BASE_PATH),
  });
}

export function useStockIssue(id: string | undefined) {
  return useQuery({
    queryKey: ['stock-issues', id],
    queryFn: () => apiRequest<StockIssueDto>(`${BASE_PATH}/${String(id)}`),
    enabled: Boolean(id),
  });
}

function useInvalidateStockIssues() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['stock-issues'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['stock-issues', id] });
    void queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export function useCreateStockIssue() {
  const invalidate = useInvalidateStockIssues();
  return useMutation({
    mutationFn: (payload: CreateStockIssueRequest) =>
      apiRequest<StockIssueDto>(BASE_PATH, { method: 'POST', body: payload }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function usePickStockIssue() {
  const invalidate = useInvalidateStockIssues();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockIssueDto>(`${BASE_PATH}/${id}/pick`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function usePostStockIssue() {
  const invalidate = useInvalidateStockIssues();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<StockIssueDto>(`${BASE_PATH}/${id}/post`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useReverseStockIssue() {
  const invalidate = useInvalidateStockIssues();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<StockIssueDto>(`${BASE_PATH}/${id}/reverse`, {
        method: 'POST',
        body: { reason },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

export function useCancelStockIssue() {
  const invalidate = useInvalidateStockIssues();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<StockIssueDto>(`${BASE_PATH}/${id}/cancel`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}
