import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CancelPurchaseOrderRequest,
  CreatePurchaseOrderRequest,
  PurchaseOrderDto,
  RejectPurchaseOrderRequest,
  UpdatePurchaseOrderRequest,
} from '@inventory-ms/contracts';
import { apiRequest } from '@/lib/apiClient';

const BASE_PATH = '/api/v1/purchase-orders';

export function usePurchaseOrders(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => apiRequest<PurchaseOrderDto[]>(BASE_PATH),
    enabled: options.enabled ?? true,
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => apiRequest<PurchaseOrderDto>(`${BASE_PATH}/${String(id)}`),
    enabled: Boolean(id),
  });
}

function useInvalidatePurchaseOrders() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['purchase-orders', id] });
  };
}

export function useCreatePurchaseOrder() {
  const invalidate = useInvalidatePurchaseOrders();
  return useMutation({
    mutationFn: (payload: CreatePurchaseOrderRequest) =>
      apiRequest<PurchaseOrderDto>(BASE_PATH, { method: 'POST', body: payload }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useUpdatePurchaseOrder() {
  const invalidate = useInvalidatePurchaseOrders();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePurchaseOrderRequest }) =>
      apiRequest<PurchaseOrderDto>(`${BASE_PATH}/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

function useTransition(action: 'submit' | 'approve') {
  const invalidate = useInvalidatePurchaseOrders();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<PurchaseOrderDto>(`${BASE_PATH}/${id}/${action}`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      invalidate(id);
    },
  });
}

export function useSubmitPurchaseOrder() {
  return useTransition('submit');
}

export function useApprovePurchaseOrder() {
  return useTransition('approve');
}

export function useRejectPurchaseOrder() {
  const invalidate = useInvalidatePurchaseOrders();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<PurchaseOrderDto>(`${BASE_PATH}/${id}/reject`, {
        method: 'POST',
        body: { reason } satisfies RejectPurchaseOrderRequest,
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}

export function useCancelPurchaseOrder() {
  const invalidate = useInvalidatePurchaseOrders();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<PurchaseOrderDto>(`${BASE_PATH}/${id}/cancel`, {
        method: 'POST',
        body: { reason } satisfies CancelPurchaseOrderRequest,
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.id);
    },
  });
}
