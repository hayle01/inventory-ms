import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, Loader2, PackageMinus, Pencil, Send, X } from 'lucide-react';
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
import { useCreateStockIssue } from '@/features/stock-issues/api';
import { errorMessage } from '@/lib/errorMessage';
import {
  useApproveStockRequest,
  useCancelStockRequest,
  useRejectStockRequest,
  useStockRequest,
  useSubmitStockRequest,
} from './api';
import { StockRequestStatusStepper } from './StockRequestStatusStepper';
import { STOCK_REQUEST_STATUS_VARIANT } from './statusBadge';

const CANCELLABLE_STATUSES = new Set(['draft', 'submitted', 'approved', 'partially_fulfilled']);
const ISSUABLE_STATUSES = new Set(['approved', 'partially_fulfilled']);

export function StockRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { toast } = useToast();

  const stockRequest = useStockRequest(id);
  const warehouses = useWarehouses();
  const submitRequest = useSubmitStockRequest();
  const approveRequest = useApproveStockRequest();
  const rejectRequest = useRejectStockRequest();
  const createIssue = useCreateStockIssue();
  const cancelRequest = useCancelStockRequest();

  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  if (stockRequest.isLoading) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-64" />
      </main>
    );
  }

  if (stockRequest.isError || !stockRequest.data) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Button variant="outline" size="sm" onClick={() => void navigate('/apps/stock-requests')}>
          <ArrowLeft />
          Back to stock requests
        </Button>
        <ErrorState error={stockRequest.error} />
      </main>
    );
  }

  const doc = stockRequest.data;
  const warehouseName =
    warehouses.list.data?.find((entry) => entry.id === doc.warehouseId)?.name ?? '—';

  const handleCreateIssue = () => {
    createIssue
      .mutateAsync({ stockRequestId: doc.id })
      .then((issue) => {
        void navigate(`/apps/stock-issues/${issue.id}`);
      })
      .catch((error: unknown) => {
        toast({
          variant: 'destructive',
          title: 'Could not create stock issue',
          description: errorMessage(error),
        });
      });
  };

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
        to="/apps/stock-requests"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to stock requests
      </Link>

      <PageHeader
        title={doc.requestNumber}
        description={warehouseName}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STOCK_REQUEST_STATUS_VARIANT[doc.status]} className="text-sm">
              {doc.status.replace('_', ' ')}
            </Badge>
            {doc.status === 'draft' && has('stock_requests.update') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(`/apps/stock-requests/${doc.id}/edit`)}
              >
                <Pencil />
                Edit
              </Button>
            )}
            {doc.status === 'draft' && has('stock_requests.submit') && (
              <Button
                size="sm"
                disabled={submitRequest.isPending}
                onClick={() => {
                  runTransition('Submitted', submitRequest.mutateAsync(doc.id));
                }}
              >
                {submitRequest.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Submit
              </Button>
            )}
            {doc.status === 'submitted' && has('stock_requests.approve') && (
              <Button
                size="sm"
                onClick={() => {
                  setApproveOpen(true);
                }}
              >
                <Check />
                Approve
              </Button>
            )}
            {doc.status === 'submitted' && has('stock_requests.reject') && (
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
            {ISSUABLE_STATUSES.has(doc.status) && has('issues.create') && (
              <Button
                size="sm"
                disabled={createIssue.isPending}
                onClick={handleCreateIssue}
              >
                {createIssue.isPending ? <Loader2 className="animate-spin" /> : <PackageMinus />}
                Issue
              </Button>
            )}
            {CANCELLABLE_STATUSES.has(doc.status) && has('stock_requests.cancel') && (
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
          <StockRequestStatusStepper status={doc.status} />
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

      {doc.cancellationReason && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <span className="font-medium">Cancellation reason: </span>
            <span className="text-muted-foreground">{doc.cancellationReason}</span>
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
                <TableHead>Requested</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Fulfilled</TableHead>
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
                  <TableCell>{item.requestedQuantity}</TableCell>
                  <TableCell className="text-muted-foreground">{item.approvedQuantity}</TableCell>
                  <TableCell className="text-muted-foreground">{item.reservedQuantity}</TableCell>
                  <TableCell className="text-muted-foreground">{item.fulfilledQuantity}</TableCell>
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
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve stock request"
        description="Approves the full requested quantity on every line and reserves that stock. Line-by-line adjustments aren't supported yet -- reject and ask the requester to resubmit if only part of this request should be approved."
        confirmLabel="Approve"
        onConfirm={() => approveRequest.mutateAsync({ id: doc.id, payload: {} })}
      />
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject stock request"
        description="The requester will see this request as rejected. No stock is reserved."
        confirmLabel="Reject"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => rejectRequest.mutateAsync({ id: doc.id, reason: reason ?? '' })}
      />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel stock request"
        description="Releases any reserved stock and marks this request cancelled."
        confirmLabel="Cancel request"
        variant="destructive"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={(reason) => cancelRequest.mutateAsync({ id: doc.id, reason: reason ?? '' })}
      />
    </main>
  );
}
