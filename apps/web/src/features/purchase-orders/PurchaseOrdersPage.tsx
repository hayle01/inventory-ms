import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorState } from '@/components/data/ErrorState';
import { EmptyState } from '@/components/data/EmptyState';
import { ForbiddenState } from '@/components/data/ForbiddenState';
import { usePermissions } from '@/features/auth/usePermissions';
import { useSuppliers } from '@/features/suppliers/api';
import { usePurchaseOrders } from './api';
import { PurchaseOrderFormDialog } from './PurchaseOrderFormDialog';
import { PO_STATUS_VARIANT } from './statusBadge';

export function PurchaseOrdersPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const purchaseOrders = usePurchaseOrders();
  const suppliers = useSuppliers();
  const [formOpen, setFormOpen] = React.useState(false);

  if (!has('purchase_orders.view')) return <ForbiddenState module="purchase orders" />;

  const canCreate = has('purchase_orders.create');
  const supplierNameById = new Map((suppliers.list.data ?? []).map((supplier) => [supplier.id, supplier.name]));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Purchase orders"
        description="Requests to buy stock from suppliers, from draft through receipt."
        actions={
          canCreate && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus />
              New purchase order
            </Button>
          )
        }
      />

      {purchaseOrders.isLoading && <Skeleton className="h-64" />}
      {purchaseOrders.isError && <ErrorState error={purchaseOrders.error} />}

      {purchaseOrders.data && purchaseOrders.data.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No purchase orders yet"
          action={
            canCreate && (
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus />
                New purchase order
              </Button>
            )
          }
        />
      )}

      {purchaseOrders.data && purchaseOrders.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.data.map((po) => (
              <TableRow
                key={po.id}
                className="cursor-pointer"
                onClick={() => void navigate(`/apps/purchase-orders/${po.id}`)}
              >
                <TableCell className="font-medium">{po.poNumber}</TableCell>
                <TableCell className="text-muted-foreground">
                  {supplierNameById.get(po.supplierId) ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={PO_STATUS_VARIANT[po.status]}>{po.status.replace(/_/g, ' ')}</Badge>
                </TableCell>
                <TableCell>
                  {po.total} {po.currencyCode}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(po.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <PurchaseOrderFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </main>
  );
}
