import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ban, Check, ArrowLeft, Loader2, Save, Send, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
  useApproveStockCount,
  usePostStockCount,
  useRejectStockCount,
  useReverseStockCount,
  useStockCount,
  useSubmitStockCount,
  useUpdateStockCount,
} from './api';
import { StockCountStatusStepper } from './StockCountStatusStepper';
import { STOCK_COUNT_STATUS_VARIANT } from './statusBadge';

export function StockCountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { toast } = useToast();

  const stockCount = useStockCount(id);
  const warehouses = useWarehouses();
  const updateCount = useUpdateStockCount();
  const submitCount = useSubmitStockCount();
  const approveCount = useApproveStockCount();
  const rejectCount = useRejectStockCount();
  const postCount = usePostStockCount();
  const reverseCount = useReverseStockCount();

  const [entries, setEntries] = React.useState<Record<number, string>>({});
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reverseOpen, setReverseOpen] = React.useState(false);
  const hydrated = React.useRef(false);

  const doc = stockCount.data;

  React.useEffect(() => {
    if (hydrated.current || !doc) return;
    hydrated.current = true;
    const initial: Record<number, string> = {};
    for (const item of doc.items) {
      if (item.countedQuantity !== null) initial[item.lineNumber] = item.countedQuantity;
    }
    setEntries(initial);
  }, [doc]);

  if (stockCount.isLoading) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-64" />
      </main>
    );
  }

  if (stockCount.isError || !doc) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Button variant="outline" size="sm" onClick={() => void navigate('/apps/stock-counts')}>
          <ArrowLeft />
          Back to stock counts
        </Button>
        <ErrorState error={stockCount.error} />
      </main>
    );
  }

  const warehouseName =
    warehouses.list.data?.find((entry) => entry.id === doc.warehouseId)?.name ?? '—';
  const hideSystemQuantity = doc.blindCount && doc.status === 'draft';

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

  const handleSaveCounts = () => {
    const items = Object.entries(entries)
      .filter(([, value]) => value.trim() !== '')
      .map(([lineNumber, value]) => ({
        lineNumber: Number(lineNumber),
        countedQuantity: value.trim(),
      }));
    runTransition('Counts saved', updateCount.mutateAsync({ id: doc.id, payload: { items } }));
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        to="/apps/stock-counts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to stock counts
      </Link>

      <PageHeader
        title={doc.countNumber}
        description={`${warehouseName} — ${doc.scope} count${doc.blindCount ? ' (blind)' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STOCK_COUNT_STATUS_VARIANT[doc.status]} className="text-sm">
              {doc.status}
            </Badge>
            {doc.status === 'draft' && has('stock_counts.create') && (
              <Button
                variant="outline"
                size="sm"
                disabled={updateCount.isPending}
                onClick={handleSaveCounts}
              >
                {updateCount.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                Save counts
              </Button>
            )}
            {doc.status === 'draft' && has('stock_counts.submit') && (
              <Button
                size="sm"
                disabled={submitCount.isPending}
                onClick={() => {
                  runTransition('Submitted', submitCount.mutateAsync(doc.id));
                }}
              >
                {submitCount.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Submit
              </Button>
            )}
            {doc.status === 'submitted' && has('stock_counts.approve') && (
              <Button
                size="sm"
                disabled={approveCount.isPending}
                onClick={() => {
                  runTransition('Approved', approveCount.mutateAsync(doc.id));
                }}
              >
                {approveCount.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Approve
              </Button>
            )}
            {doc.status === 'submitted' && has('stock_counts.reject') && (
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
            {doc.status === 'approved' && has('stock_counts.post') && (
              <Button
                size="sm"
                disabled={postCount.isPending}
                onClick={() => {
                  runTransition('Posted', postCount.mutateAsync(doc.id));
                }}
              >
                {postCount.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Post
              </Button>
            )}
            {doc.status === 'posted' &&
              !doc.reversedAt &&
              !doc.reversalOfId &&
              has('stock_counts.reverse') && (
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
          <StockCountStatusStepper status={doc.status} isReversed={Boolean(doc.reversedAt)} />
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
          <CardTitle className="text-base">Count lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Lot</TableHead>
                {!hideSystemQuantity && <TableHead>System qty</TableHead>}
                <TableHead>Counted qty</TableHead>
                {doc.status !== 'draft' && <TableHead>Variance</TableHead>}
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
                  {!hideSystemQuantity && (
                    <TableCell className="text-muted-foreground">{item.systemQuantity}</TableCell>
                  )}
                  <TableCell>
                    {doc.status === 'draft' ? (
                      <Input
                        className="w-24"
                        inputMode="decimal"
                        value={entries[item.lineNumber] ?? ''}
                        onChange={(event) => {
                          setEntries((current) => ({
                            ...current,
                            [item.lineNumber]: event.target.value,
                          }));
                        }}
                      />
                    ) : (
                      (item.countedQuantity ?? '—')
                    )}
                  </TableCell>
                  {doc.status !== 'draft' && (
                    <TableCell
                      className={
                        item.varianceQuantity?.startsWith('-')
                          ? 'text-destructive'
                          : 'text-emerald-600'
                      }
                    >
                      {item.varianceQuantity ?? '—'}
                    </TableCell>
                  )}
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
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject stock count"
        description="No stock will move. The count stays rejected for the audit trail."
        confirmLabel="Reject"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => rejectCount.mutateAsync({ id: doc.id, reason: reason ?? '' })}
      />
      <ConfirmDialog
        open={reverseOpen}
        onOpenChange={setReverseOpen}
        title="Reverse stock count"
        description="Creates a linked reversal count with negated variances. This count stays posted for the audit trail."
        confirmLabel="Reverse"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => reverseCount.mutateAsync({ id: doc.id, reason: reason ?? '' })}
      />
    </main>
  );
}
