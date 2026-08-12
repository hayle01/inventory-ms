import { useNavigate } from 'react-router-dom';
import { PenSquare, Plus } from 'lucide-react';
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
import { useStockAdjustments } from './api';
import { STOCK_ADJUSTMENT_STATUS_VARIANT } from './statusBadge';

export function StockAdjustmentsPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const stockAdjustments = useStockAdjustments();
  const warehouses = useWarehouses();

  if (!has('adjustments.view')) return <ForbiddenState module="stock adjustments" />;

  const canCreate = has('adjustments.create');
  const warehouseNameById = new Map(
    (warehouses.list.data ?? []).map((warehouse) => [warehouse.id, warehouse.name]),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Stock adjustments"
        description="Corrections to on-hand quantity with a reason code, approval, and audit trail."
        actions={
          canCreate && (
            <Button onClick={() => void navigate('/apps/stock-adjustments/new')}>
              <Plus />
              New adjustment
            </Button>
          )
        }
      />

      {stockAdjustments.isLoading && <Skeleton className="h-64" />}
      {stockAdjustments.isError && <ErrorState error={stockAdjustments.error} />}

      {stockAdjustments.data && stockAdjustments.data.length === 0 && (
        <EmptyState
          icon={PenSquare}
          title="No stock adjustments yet"
          action={
            canCreate && (
              <Button size="sm" onClick={() => void navigate('/apps/stock-adjustments/new')}>
                <Plus />
                New adjustment
              </Button>
            )
          }
        />
      )}

      {stockAdjustments.data && stockAdjustments.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Adjustment number</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockAdjustments.data.map((stockAdjustment) => (
              <TableRow
                key={stockAdjustment.id}
                className="cursor-pointer"
                onClick={() => void navigate(`/apps/stock-adjustments/${stockAdjustment.id}`)}
              >
                <TableCell className="font-medium">
                  {stockAdjustment.adjustmentNumber}
                  {stockAdjustment.reversalOfId && (
                    <Badge variant="muted" className="ml-2">
                      Reversal
                    </Badge>
                  )}
                  {stockAdjustment.requiresElevatedApproval && (
                    <Badge variant="warning" className="ml-2">
                      Material
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {warehouseNameById.get(stockAdjustment.warehouseId) ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {stockAdjustment.reasonCode.replace('_', ' ')}
                </TableCell>
                <TableCell>
                  <Badge variant={STOCK_ADJUSTMENT_STATUS_VARIANT[stockAdjustment.status]}>
                    {stockAdjustment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {stockAdjustment.items.length}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(stockAdjustment.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
