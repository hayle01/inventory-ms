import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, Loader2, Send, Undo2 } from 'lucide-react';
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
  useCancelStockIssue,
  usePickStockIssue,
  usePostStockIssue,
  useReverseStockIssue,
  useStockIssue,
} from './api';
import { StockIssueStatusStepper } from './StockIssueStatusStepper';
import { STOCK_ISSUE_STATUS_VARIANT } from './statusBadge';

export function StockIssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { toast } = useToast();

  const stockIssue = useStockIssue(id);
  const warehouses = useWarehouses();
  const pickIssue = usePickStockIssue();
  const postIssue = usePostStockIssue();
  const reverseIssue = useReverseStockIssue();
  const cancelIssue = useCancelStockIssue();

  const [reverseOpen, setReverseOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  if (stockIssue.isLoading) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-64" />
      </main>
    );
  }

  if (stockIssue.isError || !stockIssue.data) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Button variant="outline" size="sm" onClick={() => void navigate('/apps/stock-issues')}>
          <ArrowLeft />
          Back to stock issues
        </Button>
        <ErrorState error={stockIssue.error} />
      </main>
    );
  }

  const doc = stockIssue.data;
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
        to="/apps/stock-issues"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to stock issues
      </Link>

      <PageHeader
        title={doc.issueNumber}
        description={warehouseName}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STOCK_ISSUE_STATUS_VARIANT[doc.status]} className="text-sm">
              {doc.status}
            </Badge>
            {doc.status === 'draft' && has('issues.pick') && (
              <Button
                size="sm"
                disabled={pickIssue.isPending}
                onClick={() => {
                  runTransition('Picked', pickIssue.mutateAsync(doc.id));
                }}
              >
                {pickIssue.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Confirm pick
              </Button>
            )}
            {doc.status === 'picked' && has('issues.post') && (
              <Button
                size="sm"
                disabled={postIssue.isPending}
                onClick={() => {
                  runTransition('Posted', postIssue.mutateAsync(doc.id));
                }}
              >
                {postIssue.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Post
              </Button>
            )}
            {(doc.status === 'draft' || doc.status === 'picked') && has('issues.update') && (
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
            {doc.status === 'posted' && !doc.reversedAt && has('returns.create') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(`/apps/stock-returns/new?stockIssueId=${doc.id}`)}
              >
                <Undo2 />
                Return
              </Button>
            )}
            {doc.status === 'posted' &&
              !doc.reversedAt &&
              !doc.reversalOfId &&
              has('issues.reverse') && (
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
          <StockIssueStatusStepper status={doc.status} isReversed={Boolean(doc.reversedAt)} />
        </CardContent>
      </Card>

      {doc.reversalOfId && (
        <Card>
          <CardContent className="flex items-center justify-between pt-6 text-sm">
            <span className="text-muted-foreground">This is a reversal of another issue.</span>
            <Button variant="link" size="sm" asChild>
              <Link to={`/apps/stock-issues/${doc.reversalOfId}`}>View original</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Picked lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Picked quantity</TableHead>
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
                  <TableCell>{item.pickedQuantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source request</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link to={`/apps/stock-requests/${doc.stockRequestId}`}>View stock request</Link>
          </Button>
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
        title="Reverse stock issue"
        description="Creates a linked reversal issue that returns this issue's picked stock to the balance. This issue stays posted for the audit trail."
        confirmLabel="Reverse"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => reverseIssue.mutateAsync({ id: doc.id, reason: reason ?? '' })}
      />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel stock issue"
        description="No stock has moved yet -- this only cancels the draft pick."
        confirmLabel="Cancel issue"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => cancelIssue.mutateAsync({ id: doc.id, reason: reason ?? '' })}
      />
    </main>
  );
}
