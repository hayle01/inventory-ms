import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, Loader2, PackageCheck, Pencil, Send, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { ConfirmDialog } from '@/components/data/ConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/features/auth/usePermissions';
import { useSuppliers } from '@/features/suppliers/api';
import { useWarehouses } from '@/features/warehouses/api';
import { errorMessage } from '@/lib/errorMessage';
import {
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
  usePurchaseOrder,
  useRejectPurchaseOrder,
  useSubmitPurchaseOrder,
} from './api';
import { PurchaseOrderStatusStepper } from './PurchaseOrderStatusStepper';
import { PO_STATUS_VARIANT } from './statusBadge';

const OPEN_STATUSES = new Set(['draft', 'submitted', 'approved', 'partially_received']);
const RECEIVABLE_STATUSES = new Set(['approved', 'partially_received']);

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { toast } = useToast();

  const po = usePurchaseOrder(id);
  const suppliers = useSuppliers();
  const warehouses = useWarehouses();
  const submitPO = useSubmitPurchaseOrder();
  const approvePO = useApprovePurchaseOrder();
  const rejectPO = useRejectPurchaseOrder();
  const cancelPO = useCancelPurchaseOrder();

  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  if (po.isLoading) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-64" />
      </main>
    );
  }

  if (po.isError || !po.data) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Button variant="outline" size="sm" onClick={() => void navigate('/apps/purchase-orders')}>
          <ArrowLeft />
          Back to purchase orders
        </Button>
        <ErrorState error={po.error} />
      </main>
    );
  }

  const order = po.data;
  const supplierName =
    suppliers.list.data?.find((entry) => entry.id === order.supplierId)?.name ?? '—';
  const warehouseName =
    warehouses.list.data?.find((entry) => entry.id === order.warehouseId)?.name ?? '—';

  const runTransition = (label: string, promise: Promise<unknown>) => {
    promise
      .then(() => {
        toast({ variant: 'success', title: label });
      })
      .catch((error: unknown) => {
        toast({
          variant: 'destructive',
          title: `${label} failed`,
          description: errorMessage(error),
        });
      });
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        to="/apps/purchase-orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to purchase orders
      </Link>

      <PageHeader
        title={order.poNumber}
        description={`${supplierName} → ${warehouseName}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={PO_STATUS_VARIANT[order.status]} className="text-sm">
              {order.status.replace(/_/g, ' ')}
            </Badge>
            {order.status === 'draft' && has('purchase_orders.update') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(`/apps/purchase-orders/${order.id}/edit`)}
              >
                <Pencil />
                Edit
              </Button>
            )}
            {order.status === 'draft' && has('purchase_orders.submit') && (
              <Button
                size="sm"
                disabled={submitPO.isPending}
                onClick={() => {
                  runTransition('Submitted for approval', submitPO.mutateAsync(order.id));
                }}
              >
                {submitPO.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Submit
              </Button>
            )}
            {order.status === 'submitted' && has('purchase_orders.approve') && (
              <Button
                size="sm"
                disabled={approvePO.isPending}
                onClick={() => {
                  runTransition('Approved', approvePO.mutateAsync(order.id));
                }}
              >
                {approvePO.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Approve
              </Button>
            )}
            {RECEIVABLE_STATUSES.has(order.status) && has('receipts.create') && (
              <Button
                size="sm"
                onClick={() =>
                  void navigate(`/apps/goods-receipts/new?purchaseOrderId=${order.id}`)
                }
              >
                <PackageCheck />
                Receive
              </Button>
            )}
            {order.status === 'submitted' && has('purchase_orders.reject') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setRejectOpen(true);
                }}
              >
                <X />
                Reject
              </Button>
            )}
            {OPEN_STATUSES.has(order.status) && has('purchase_orders.cancel') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCancelOpen(true);
                }}
              >
                <Ban />
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <PurchaseOrderStatusStepper status={order.status} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Subtotal</CardDescription>
            <CardTitle className="text-lg">
              {order.subtotal} {order.currencyCode}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tax + discount</CardDescription>
            <CardTitle className="text-lg">
              {order.taxTotal} / {order.discountTotal}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-lg">
              {order.total} {order.currencyCode}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Unit cost</TableHead>
                <TableHead>Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.lineNumber}>
                  <TableCell>{item.lineNumber}</TableCell>
                  <TableCell>
                    <p className="font-medium">{item.productName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{item.productSku}</p>
                  </TableCell>
                  <TableCell>{item.orderedQuantity}</TableCell>
                  <TableCell className="text-muted-foreground">{item.receivedQuantity}</TableCell>
                  <TableCell>{item.unitCost}</TableCell>
                  <TableCell className="font-medium">{item.lineTotal}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{order.notes}</CardContent>
        </Card>
      )}

      {(order.rejectionReason ?? order.cancellationReason) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {order.status === 'rejected' ? 'Rejection reason' : 'Cancellation reason'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {order.rejectionReason ?? order.cancellationReason}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject purchase order"
        description="The requester will be notified. This action is recorded in the audit trail."
        confirmLabel="Reject"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => rejectPO.mutateAsync({ id: order.id, reason: reason ?? '' })}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel purchase order"
        description="This purchase order will be cancelled and can no longer be actioned."
        confirmLabel="Cancel order"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => cancelPO.mutateAsync({ id: order.id, reason: reason ?? '' })}
      />
    </main>
  );
}
