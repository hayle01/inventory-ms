import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Plus } from 'lucide-react';
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
import { useStockTransfers } from './api';
import { STOCK_TRANSFER_STATUS_VARIANT } from './statusBadge';

export function StockTransfersPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const stockTransfers = useStockTransfers();
  const warehouses = useWarehouses();

  if (!has('transfers.view')) return <ForbiddenState module="stock transfers" />;

  const canCreate = has('transfers.create');
  const warehouseNameById = new Map(
    (warehouses.list.data ?? []).map((warehouse) => [warehouse.id, warehouse.name]),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Stock transfers"
        description="Stock moved between warehouses or locations, immediately or in transit."
        actions={
          canCreate && (
            <Button onClick={() => void navigate('/apps/stock-transfers/new')}>
              <Plus />
              New transfer
            </Button>
          )
        }
      />

      {stockTransfers.isLoading && <Skeleton className="h-64" />}
      {stockTransfers.isError && <ErrorState error={stockTransfers.error} />}

      {stockTransfers.data && stockTransfers.data.length === 0 && (
        <EmptyState
          icon={ArrowLeftRight}
          title="No stock transfers yet"
          action={
            canCreate && (
              <Button size="sm" onClick={() => void navigate('/apps/stock-transfers/new')}>
                <Plus />
                New transfer
              </Button>
            )
          }
        />
      )}

      {stockTransfers.data && stockTransfers.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer number</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Policy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockTransfers.data.map((stockTransfer) => (
              <TableRow
                key={stockTransfer.id}
                className="cursor-pointer"
                onClick={() => void navigate(`/apps/stock-transfers/${stockTransfer.id}`)}
              >
                <TableCell className="font-medium">
                  {stockTransfer.transferNumber}
                  {stockTransfer.reversalOfId && (
                    <Badge variant="muted" className="ml-2">
                      Reversal
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {warehouseNameById.get(stockTransfer.sourceWarehouseId) ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {warehouseNameById.get(stockTransfer.destinationWarehouseId) ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {stockTransfer.inTransitPolicy.replace('_', ' ')}
                </TableCell>
                <TableCell>
                  <Badge variant={STOCK_TRANSFER_STATUS_VARIANT[stockTransfer.status]}>
                    {stockTransfer.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(stockTransfer.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
