import { useQuery } from '@tanstack/react-query';
import type {
  AuditEventDto,
  ExpiryReportQuery,
  ExpiryReportResponse,
  InventoryReportQuery,
  InventoryReportResponse,
  IssuesReportQuery,
  IssuesReportResponse,
  LowStockReportQuery,
  LowStockReportResponse,
  PurchasesReportQuery,
  PurchasesReportResponse,
  StockMovementReportQuery,
  StockMovementReportResponse,
} from '@inventory-ms/contracts';
import { apiRequest, apiRequestPaginated, type PaginationMeta } from '@/lib/apiClient';

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function useInventoryReport(params: Partial<InventoryReportQuery>) {
  return useQuery({
    queryKey: ['reports', 'inventory', params],
    queryFn: () =>
      apiRequest<InventoryReportResponse>(`/api/v1/reports/inventory${toQueryString(params)}`),
  });
}

export function useStockMovementReport(params: Partial<StockMovementReportQuery>) {
  return useQuery({
    queryKey: ['reports', 'stock-movement', params],
    queryFn: () =>
      apiRequest<StockMovementReportResponse>(
        `/api/v1/reports/stock-movement${toQueryString(params)}`,
      ),
  });
}

export function usePurchasesReport(params: Partial<PurchasesReportQuery>) {
  return useQuery({
    queryKey: ['reports', 'purchases', params],
    queryFn: () =>
      apiRequest<PurchasesReportResponse>(`/api/v1/reports/purchases${toQueryString(params)}`),
  });
}

export function useIssuesReport(params: Partial<IssuesReportQuery>) {
  return useQuery({
    queryKey: ['reports', 'issues', params],
    queryFn: () => apiRequest<IssuesReportResponse>(`/api/v1/reports/issues${toQueryString(params)}`),
  });
}

export function useLowStockReport(params: Partial<LowStockReportQuery>) {
  return useQuery({
    queryKey: ['reports', 'low-stock', params],
    queryFn: () =>
      apiRequest<LowStockReportResponse>(`/api/v1/reports/low-stock${toQueryString(params)}`),
  });
}

export function useExpiryReport(params: Partial<ExpiryReportQuery>) {
  return useQuery({
    queryKey: ['reports', 'expiry', params],
    queryFn: () => apiRequest<ExpiryReportResponse>(`/api/v1/reports/expiry${toQueryString(params)}`),
  });
}

export function useAuditEvents(params: {
  resourceType?: string | undefined;
  action?: string | undefined;
  outcome?: string | undefined;
  page: number;
  perPage: number;
}) {
  return useQuery<{ data: AuditEventDto[]; meta: PaginationMeta }>({
    queryKey: ['reports', 'audit-events', params],
    queryFn: () => apiRequestPaginated<AuditEventDto[]>(`/api/v1/audit-events${toQueryString(params)}`),
  });
}
