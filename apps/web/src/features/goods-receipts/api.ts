import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateGoodsReceiptRequest,
  GoodsReceiptDto,
  UpdateGoodsReceiptRequest,
} from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/goods-receipts';

export function useGoodsReceipts() {
  return useQuery({
    queryKey: ['goods-receipts'],
    queryFn: () => apiRequest<GoodsReceiptDto[]>(BASE_PATH),
  });
}

export function useGoodsReceipt(id: string | undefined) {
  return useQuery({
    queryKey: ['goods-receipts', id],
    queryFn: () => apiRequest<GoodsReceiptDto>(`${BASE_PATH}/${String(id)}`),
    enabled: Boolean(id),
  });
}

function useInvalidateGoodsReceipts() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['goods-receipts', id] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
  };
}

export function useCreateGoodsReceipt() {
  const invalidate = useInvalidateGoodsReceipts();
  return useMutation({
    mutationFn: (payload: CreateGoodsReceiptRequest) =>
      apiRequest<GoodsReceiptDto>(BASE_PATH, { method: 'POST', body: payload }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useUpdateGoodsReceipt() {
  const invalidate = useInvalidateGoodsReceipts();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateGoodsReceiptRequest }) =>
      apiRequest<GoodsReceiptDto>(`${BASE_PATH}/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

export function useVerifyGoodsReceipt() {
  const invalidate = useInvalidateGoodsReceipts();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<GoodsReceiptDto>(`${BASE_PATH}/${id}/verify`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function usePostGoodsReceipt() {
  const invalidate = useInvalidateGoodsReceipts();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<GoodsReceiptDto>(`${BASE_PATH}/${id}/post`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useReverseGoodsReceipt() {
  const invalidate = useInvalidateGoodsReceipts();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<GoodsReceiptDto>(`${BASE_PATH}/${id}/reverse`, {
        method: 'POST',
        body: { reason },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}
