import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, Loader2, Pencil, Send } from 'lucide-react';
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
  useGoodsReceipt,
  usePostGoodsReceipt,
  useReverseGoodsReceipt,
  useVerifyGoodsReceipt,
} from './api';
import { GoodsReceiptStatusStepper } from './GoodsReceiptStatusStepper';
import { RECEIPT_STATUS_VARIANT } from './statusBadge';

export function GoodsReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { toast } = useToast();

  const receipt = useGoodsReceipt(id);
  const suppliers = useSuppliers();
  const warehouses = useWarehouses();
  const verifyReceipt = useVerifyGoodsReceipt();
  const postReceipt = usePostGoodsReceipt();
  const reverseReceipt = useReverseGoodsReceipt();

  const [reverseOpen, setReverseOpen] = React.useState(false);

  if (receipt.isLoading) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-64" />
      </main>
    );
  }

  if (receipt.isError || !receipt.data) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Button variant="outline" size="sm" onClick={() => void navigate('/apps/goods-receipts')}>
          <ArrowLeft />
          Back to goods receipts
        </Button>
        <ErrorState error={receipt.error} />
      </main>
    );
  }

  const doc = receipt.data;
  const supplierName =
    suppliers.list.data?.find((entry) => entry.id === doc.supplierId)?.name ?? '—';
  const warehouseName =
    warehouses.list.data?.find((entry) => entry.id === doc.warehouseId)?.name ?? '—';

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
        to="/apps/goods-receipts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to goods receipts
      </Link>

      <PageHeader
        title={doc.receiptNumber}
        description={`${supplierName} → ${warehouseName}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={RECEIPT_STATUS_VARIANT[doc.status]} className="text-sm">
              {doc.status}
            </Badge>
            {doc.status === 'draft' && has('receipts.update') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(`/apps/goods-receipts/${doc.id}/edit`)}
              >
                <Pencil />
                Edit
              </Button>
            )}
            {doc.status === 'draft' && has('receipts.verify') && (
              <Button
                size="sm"
                disabled={verifyReceipt.isPending}
                onClick={() => {
                  runTransition('Verified', verifyReceipt.mutateAsync(doc.id));
                }}
              >
                {verifyReceipt.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Verify
              </Button>
            )}
            {doc.status === 'verified' && has('receipts.post') && (
              <Button
                size="sm"
                disabled={postReceipt.isPending}
                onClick={() => {
                  runTransition('Posted', postReceipt.mutateAsync(doc.id));
                }}
              >
                {postReceipt.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Post
              </Button>
            )}
            {doc.status === 'posted' &&
              !doc.reversedAt &&
              !doc.reversalOfId &&
              has('receipts.reverse') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReverseOpen(true);
                  }}
                >
                  <Ban />
                  Reverse
                </Button>
              )}
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <GoodsReceiptStatusStepper status={doc.status} isReversed={Boolean(doc.reversedAt)} />
        </CardContent>
      </Card>

      {doc.reversalOfId && (
        <Card>
          <CardContent className="flex items-center justify-between pt-6 text-sm">
            <span className="text-muted-foreground">This is a reversal of another receipt.</span>
            <Button variant="link" size="sm" asChild>
              <Link to={`/apps/goods-receipts/${doc.reversalOfId}`}>View original</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
          {doc.purchaseOrderId && (
            <CardDescription>
              Against{' '}
              <Link to={`/apps/purchase-orders/${doc.purchaseOrderId}`} className="underline">
                purchase order
              </Link>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Accepted</TableHead>
                <TableHead>Rejected</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Unit cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.items.map((item) => (
                <TableRow key={item.lineNumber}>
                  <TableCell>{item.lineNumber}</TableCell>
                  <TableCell>
                    <p className="font-medium">{item.productName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{item.productSku}</p>
                  </TableCell>
                  <TableCell>{item.receivedQuantity}</TableCell>
                  <TableCell>{item.acceptedQuantity}</TableCell>
                  <TableCell className="text-muted-foreground">{item.rejectedQuantity}</TableCell>
                  <TableCell className="capitalize">{item.condition}</TableCell>
                  <TableCell className="text-muted-foreground">{item.lotNumber ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>{item.unitCost}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {doc.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{doc.notes}</CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={reverseOpen}
        onOpenChange={setReverseOpen}
        title="Reverse goods receipt"
        description="Creates a linked reversal receipt that removes this receipt's accepted stock from the balance. This receipt stays posted for the audit trail."
        confirmLabel="Reverse"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => reverseReceipt.mutateAsync({ id: doc.id, reason: reason ?? '' })}
      />
    </main>
  );
}
