import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Plus } from 'lucide-react';
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
import { useStockCounts } from './api';
import { STOCK_COUNT_STATUS_VARIANT } from './statusBadge';

export function StockCountsPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const stockCounts = useStockCounts();
  const warehouses = useWarehouses();

  if (!has('stock_counts.view')) return <ForbiddenState module="stock counts" />;

  const canCreate = has('stock_counts.create');
  const warehouseNameById = new Map(
    (warehouses.list.data ?? []).map((warehouse) => [warehouse.id, warehouse.name]),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Stock counts"
        description="Cycle and full counts with a system snapshot, count entry, variance approval, and posting."
        actions={
          canCreate && (
            <Button onClick={() => void navigate('/apps/stock-counts/new')}>
              <Plus />
              New count
            </Button>
          )
        }
      />

      {stockCounts.isLoading && <Skeleton className="h-64" />}
      {stockCounts.isError && <ErrorState error={stockCounts.error} />}

      {stockCounts.data && stockCounts.data.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title="No stock counts yet"
          action={
            canCreate && (
              <Button size="sm" onClick={() => void navigate('/apps/stock-counts/new')}>
                <Plus />
                New count
              </Button>
            )
          }
        />
      )}

      {stockCounts.data && stockCounts.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Count number</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Variance lines</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockCounts.data.map((stockCount) => (
              <TableRow
                key={stockCount.id}
                className="cursor-pointer"
                onClick={() => void navigate(`/apps/stock-counts/${stockCount.id}`)}
              >
                <TableCell className="font-medium">
                  {stockCount.countNumber}
                  {stockCount.reversalOfId && (
                    <Badge variant="muted" className="ml-2">
                      Reversal
                    </Badge>
                  )}
                  {stockCount.blindCount && (
                    <Badge variant="outline" className="ml-2">
                      Blind
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {warehouseNameById.get(stockCount.warehouseId) ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {stockCount.scope}
                </TableCell>
                <TableCell>
                  <Badge variant={STOCK_COUNT_STATUS_VARIANT[stockCount.status]}>
                    {stockCount.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {stockCount.varianceLineCount}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(stockCount.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
