import { useNavigate } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
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
import { useStockReturns } from './api';
import { STOCK_RETURN_STATUS_VARIANT } from './statusBadge';

export function StockReturnsPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const stockReturns = useStockReturns();

  if (!has('returns.view')) return <ForbiddenState module="stock returns" />;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Stock returns"
        description="Stock returned against a posted issue. Create one from a posted stock issue's detail page."
      />

      {stockReturns.isLoading && <Skeleton className="h-64" />}
      {stockReturns.isError && <ErrorState error={stockReturns.error} />}

      {stockReturns.data && stockReturns.data.length === 0 && (
        <EmptyState icon={Undo2} title="No stock returns yet" />
      )}

      {stockReturns.data && stockReturns.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockReturns.data.map((stockReturn) => (
              <TableRow
                key={stockReturn.id}
                className="cursor-pointer"
                onClick={() => void navigate(`/apps/stock-returns/${stockReturn.id}`)}
              >
                <TableCell className="font-medium">{stockReturn.returnNumber}</TableCell>
                <TableCell>
                  <Badge variant={STOCK_RETURN_STATUS_VARIANT[stockReturn.status]}>
                    {stockReturn.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {stockReturn.items.length}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(stockReturn.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
