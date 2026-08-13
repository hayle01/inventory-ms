import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
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
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/features/auth/usePermissions';
import { errorMessage } from '@/lib/errorMessage';
import { usePostStockReturn, useStockReturn } from './api';
import { STOCK_RETURN_STATUS_VARIANT } from './statusBadge';

export function StockReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { toast } = useToast();

  const stockReturn = useStockReturn(id);
  const postReturn = usePostStockReturn();

  if (stockReturn.isLoading) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-64" />
      </main>
    );
  }

  if (stockReturn.isError || !stockReturn.data) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Button variant="outline" size="sm" onClick={() => void navigate('/apps/stock-returns')}>
          <ArrowLeft />
          Back to stock returns
        </Button>
        <ErrorState error={stockReturn.error} />
      </main>
    );
  }

  const doc = stockReturn.data;

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
        to="/apps/stock-returns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to stock returns
      </Link>

      <PageHeader
        title={doc.returnNumber}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STOCK_RETURN_STATUS_VARIANT[doc.status]} className="text-sm">
              {doc.status}
            </Badge>
            {doc.status === 'draft' && has('returns.post') && (
              <Button
                size="sm"
                disabled={postReturn.isPending}
                onClick={() => {
                  runTransition('Posted', postReturn.mutateAsync(doc.id));
                }}
              >
                {postReturn.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Post
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Returned lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Reason</TableHead>
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
                  <TableCell className="capitalize">{item.condition}</TableCell>
                  <TableCell className="text-muted-foreground">{item.reason ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source issue</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link to={`/apps/stock-issues/${doc.stockIssueId}`}>View stock issue</Link>
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
    </main>
  );
}
