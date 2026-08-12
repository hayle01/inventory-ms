import { useNavigate } from 'react-router-dom';
import { PackageMinus } from 'lucide-react';
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
import { useWarehouses } from '@/features/warehouses/api';
import { useStockIssues } from './api';
import { STOCK_ISSUE_STATUS_VARIANT } from './statusBadge';

export function StockIssuesPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const stockIssues = useStockIssues();
  const warehouses = useWarehouses();

  if (!has('issues.view')) return <ForbiddenState module="stock issues" />;

  const warehouseNameById = new Map(
    (warehouses.list.data ?? []).map((warehouse) => [warehouse.id, warehouse.name]),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Stock issues"
        description="Stock picked and issued against approved stock requests. Create one from an approved stock request's detail page."
      />

      {stockIssues.isLoading && <Skeleton className="h-64" />}
      {stockIssues.isError && <ErrorState error={stockIssues.error} />}

      {stockIssues.data && stockIssues.data.length === 0 && (
        <EmptyState icon={PackageMinus} title="No stock issues yet" />
      )}

      {stockIssues.data && stockIssues.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issue number</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockIssues.data.map((stockIssue) => (
              <TableRow
                key={stockIssue.id}
                className="cursor-pointer"
                onClick={() => void navigate(`/apps/stock-issues/${stockIssue.id}`)}
              >
                <TableCell className="font-medium">
                  {stockIssue.issueNumber}
                  {stockIssue.reversalOfId && (
                    <Badge variant="muted" className="ml-2">
                      Reversal
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {warehouseNameById.get(stockIssue.warehouseId) ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={STOCK_ISSUE_STATUS_VARIANT[stockIssue.status]}>
                    {stockIssue.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{stockIssue.items.length}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(stockIssue.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
