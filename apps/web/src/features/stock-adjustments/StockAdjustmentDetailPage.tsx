import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, Loader2, Pencil, Send, X } from 'lucide-react';
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
  useApproveStockAdjustment,
  usePostStockAdjustment,
  useRejectStockAdjustment,
  useReverseStockAdjustment,
  useStockAdjustment,
  useSubmitStockAdjustment,
} from './api';
import { StockAdjustmentStatusStepper } from './StockAdjustmentStatusStepper';
import { STOCK_ADJUSTMENT_STATUS_VARIANT } from './statusBadge';

export function StockAdjustmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { toast } = useToast();

  const stockAdjustment = useStockAdjustment(id);
  const warehouses = useWarehouses();
  const submitAdjustment = useSubmitStockAdjustment();
  const approveAdjustment = useApproveStockAdjustment();
  const rejectAdjustment = useRejectStockAdjustment();
  const postAdjustment = usePostStockAdjustment();
  const reverseAdjustment = useReverseStockAdjustment();

  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reverseOpen, setReverseOpen] = React.useState(false);

  if (stockAdjustment.isLoading) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-64" />
      </main>
    );
  }

  if (stockAdjustment.isError || !stockAdjustment.data) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void navigate('/apps/stock-adjustments')}
        >
          <ArrowLeft />
          Back to stock adjustments
        </Button>
        <ErrorState error={stockAdjustment.error} />
      </main>
    );
  }

  const doc = stockAdjustment.data;
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
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        to="/apps/stock-adjustments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to stock adjustments
      </Link>

      <PageHeader
        title={doc.adjustmentNumber}
        description={`${warehouseName} — ${doc.reasonCode.replace('_', ' ')}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STOCK_ADJUSTMENT_STATUS_VARIANT[doc.status]} className="text-sm">
              {doc.status}
            </Badge>
            {doc.requiresElevatedApproval && <Badge variant="warning">Material</Badge>}
            {doc.status === 'draft' && has('adjustments.create') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(`/apps/stock-adjustments/${doc.id}/edit`)}
              >
                <Pencil />
                Edit
              </Button>
            )}
            {doc.status === 'draft' && has('adjustments.submit') && (
              <Button
                size="sm"
                disabled={submitAdjustment.isPending}
                onClick={() => {
                  runTransition('Submitted', submitAdjustment.mutateAsync(doc.id));
                }}
              >
                {submitAdjustment.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Submit
              </Button>
            )}
            {doc.status === 'submitted' && has('adjustments.approve') && (
              <Button
                size="sm"
                disabled={approveAdjustment.isPending}
                onClick={() => {
                  runTransition('Approved', approveAdjustment.mutateAsync(doc.id));
                }}
              >
                {approveAdjustment.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Approve
              </Button>
            )}
            {doc.status === 'submitted' && has('adjustments.reject') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRejectOpen(true);
                }}
              >
                <X />
                Reject
              </Button>
            )}
            {doc.status === 'approved' && has('adjustments.post') && (
              <Button
                size="sm"
                disabled={postAdjustment.isPending}
                onClick={() => {
                  runTransition('Posted', postAdjustment.mutateAsync(doc.id));
                }}
              >
                {postAdjustment.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Post
              </Button>
            )}
            {doc.status === 'posted' &&
              !doc.reversedAt &&
              !doc.reversalOfId &&
              has('adjustments.reverse') && (
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
          <StockAdjustmentStatusStepper status={doc.status} isReversed={Boolean(doc.reversedAt)} />
        </CardContent>
      </Card>

      {doc.rejectionReason && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <span className="font-medium">Rejection reason: </span>
            <span className="text-muted-foreground">{doc.rejectionReason}</span>
          </CardContent>
        </Card>
      )}

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
                <TableHead>Stock state</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Prior</TableHead>
                <TableHead>Resulting</TableHead>
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
                  <TableCell className="capitalize">{item.stockState}</TableCell>
                  <TableCell
                    className={
                      item.quantityDelta.startsWith('-') ? 'text-destructive' : 'text-emerald-600'
                    }
                  >
                    {item.quantityDelta}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.priorQuantity ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.resultingQuantity ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.note ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {doc.evidenceNote && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{doc.evidenceNote}</CardContent>
        </Card>
      )}

      {doc.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{doc.notes}</CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject stock adjustment"
        description="No stock will move. The adjustment stays rejected for the audit trail."
        confirmLabel="Reject"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => rejectAdjustment.mutateAsync({ id: doc.id, reason: reason ?? '' })}
      />
      <ConfirmDialog
        open={reverseOpen}
        onOpenChange={setReverseOpen}
        title="Reverse stock adjustment"
        description="Creates a linked reversal adjustment with negated deltas. This adjustment stays posted for the audit trail."
        confirmLabel="Reverse"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => reverseAdjustment.mutateAsync({ id: doc.id, reason: reason ?? '' })}
      />
    </main>
  );
}
