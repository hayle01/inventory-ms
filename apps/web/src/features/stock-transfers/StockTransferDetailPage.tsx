import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, Loader2, PackageCheck, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useWarehouses } from '@/features/warehouses/api';
import { errorMessage } from '@/lib/errorMessage';
import {
  useApproveStockTransfer,
  usePostStockTransfer,
  useReceiveStockTransfer,
  useReverseStockTransfer,
  useStockTransfer,
  useSubmitStockTransfer,
} from './api';
import { StockTransferStatusStepper } from './StockTransferStatusStepper';
import { STOCK_TRANSFER_STATUS_VARIANT } from './statusBadge';

export function StockTransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { toast } = useToast();

  const stockTransfer = useStockTransfer(id);
  const warehouses = useWarehouses();
  const submitTransfer = useSubmitStockTransfer();
  const approveTransfer = useApproveStockTransfer();
  const postTransfer = usePostStockTransfer();
  const receiveTransfer = useReceiveStockTransfer();
  const reverseTransfer = useReverseStockTransfer();

  const [reverseOpen, setReverseOpen] = React.useState(false);

  if (stockTransfer.isLoading) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-64" />
      </main>
    );
  }

  if (stockTransfer.isError || !stockTransfer.data) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Button variant="outline" size="sm" onClick={() => void navigate('/apps/stock-transfers')}>
          <ArrowLeft />
          Back to stock transfers
        </Button>
        <ErrorState error={stockTransfer.error} />
      </main>
    );
  }

  const doc = stockTransfer.data;
  const sourceWarehouseName =
    warehouses.list.data?.find((entry) => entry.id === doc.sourceWarehouseId)?.name ?? '—';
  const destinationWarehouseName =
    warehouses.list.data?.find((entry) => entry.id === doc.destinationWarehouseId)?.name ?? '—';

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
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        to="/apps/stock-transfers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to stock transfers
      </Link>

      <PageHeader
        title={doc.transferNumber}
        description={`${sourceWarehouseName} → ${destinationWarehouseName} (${doc.inTransitPolicy.replace('_', ' ')})`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STOCK_TRANSFER_STATUS_VARIANT[doc.status]} className="text-sm">
              {doc.status.replace('_', ' ')}
            </Badge>
            {doc.status === 'draft' && has('transfers.submit') && (
              <Button
                size="sm"
                disabled={submitTransfer.isPending}
                onClick={() => {
                  runTransition('Submitted', submitTransfer.mutateAsync(doc.id));
                }}
              >
                {submitTransfer.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Submit
              </Button>
            )}
            {doc.status === 'submitted' && has('transfers.approve') && (
              <Button
                size="sm"
                disabled={approveTransfer.isPending}
                onClick={() => {
                  runTransition('Approved', approveTransfer.mutateAsync(doc.id));
                }}
              >
                {approveTransfer.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Approve
              </Button>
            )}
            {doc.status === 'approved' && has('transfers.post') && (
              <Button
                size="sm"
                disabled={postTransfer.isPending}
                onClick={() => {
                  runTransition('Posted', postTransfer.mutateAsync(doc.id));
                }}
              >
                {postTransfer.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Post
              </Button>
            )}
            {doc.status === 'in_transit' && has('transfers.post') && (
              <Button
                size="sm"
                disabled={receiveTransfer.isPending}
                onClick={() => {
                  runTransition('Received', receiveTransfer.mutateAsync(doc.id));
                }}
              >
                {receiveTransfer.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <PackageCheck />
                )}
                Receive
              </Button>
            )}
            {doc.status === 'completed' &&
              !doc.reversedAt &&
              !doc.reversalOfId &&
              has('transfers.reverse') && (
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
          <StockTransferStatusStepper status={doc.status} isReversed={Boolean(doc.reversedAt)} />
        </CardContent>
      </Card>

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
                <TableHead>Lot</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Note</TableHead>
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
                  <TableCell className="text-muted-foreground">{item.lotNumber ?? '—'}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{item.note ?? '—'}</TableCell>
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
        title="Reverse stock transfer"
        description="Creates a linked reversal transfer that sends this transfer's stock back to its source. This transfer stays completed for the audit trail."
        confirmLabel="Reverse"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => reverseTransfer.mutateAsync({ id: doc.id, reason: reason ?? '' })}
      />
    </main>
  );
}
