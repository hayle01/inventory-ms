import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ErrorState } from '@/components/data/ErrorState';
import { EmptyState } from '@/components/data/EmptyState';
import { ForbiddenState } from '@/components/data/ForbiddenState';
import { usePermissions } from '@/features/auth/usePermissions';
import { useWarehouses } from '@/features/warehouses/api';
import { useStockRequests } from './api';
import { STOCK_REQUEST_STATUS_VARIANT } from './statusBadge';

export function StockRequestsPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const stockRequests = useStockRequests();
  const warehouses = useWarehouses();

  if (!has('stock_requests.view')) return <ForbiddenState module="stock requests" />;

  const canCreate = has('stock_requests.create');
  const warehouseNameById = new Map(
    (warehouses.list.data ?? []).map((warehouse) => [warehouse.id, warehouse.name]),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Stock requests"
        description="Requests for stock raised by departments and requesters."
        actions={
          canCreate && (
            <Button onClick={() => void navigate('/apps/stock-requests/new')}>
              <Plus />
              New stock request
            </Button>
          )
        }
      />

      {stockRequests.isLoading && <Skeleton className="h-64" />}
      {stockRequests.isError && <ErrorState error={stockRequests.error} />}

      {stockRequests.data && stockRequests.data.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No stock requests yet"
          action={
            canCreate && (
              <Button size="sm" onClick={() => void navigate('/apps/stock-requests/new')}>
                <Plus />
                New stock request
              </Button>
            )
          }
        />
      )}

      {stockRequests.data && stockRequests.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request number</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockRequests.data.map((stockRequest) => (
              <TableRow
                key={stockRequest.id}
                className="cursor-pointer"
                onClick={() => void navigate(`/apps/stock-requests/${stockRequest.id}`)}
              >
                <TableCell className="font-medium">{stockRequest.requestNumber}</TableCell>
                <TableCell className="text-muted-foreground">
                  {warehouseNameById.get(stockRequest.warehouseId) ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={STOCK_REQUEST_STATUS_VARIANT[stockRequest.status]}>
                    {stockRequest.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {stockRequest.items.length}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(stockRequest.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
