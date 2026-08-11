import { useNavigate } from 'react-router-dom';
import { PackageCheck, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
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
import { useSuppliers } from '@/features/suppliers/api';
import { useGoodsReceipts } from './api';
import { RECEIPT_STATUS_VARIANT } from './statusBadge';

export function GoodsReceiptsPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const receipts = useGoodsReceipts();
  const suppliers = useSuppliers();

  if (!has('receipts.view')) return <ForbiddenState module="goods receipts" />;

  const canCreate = has('receipts.create');
  const supplierNameById = new Map(
    (suppliers.list.data ?? []).map((supplier) => [supplier.id, supplier.name]),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Goods receipts"
        description="Stock received against purchase orders or direct deliveries."
        actions={
          canCreate && (
            <Button onClick={() => void navigate('/apps/goods-receipts/new')}>
              <Plus />
              New goods receipt
            </Button>
          )
        }
      />

      {receipts.isLoading && <Skeleton className="h-64" />}
      {receipts.isError && <ErrorState error={receipts.error} />}

      {receipts.data && receipts.data.length === 0 && (
        <EmptyState
          icon={PackageCheck}
          title="No goods receipts yet"
          action={
            canCreate && (
              <Button size="sm" onClick={() => void navigate('/apps/goods-receipts/new')}>
                <Plus />
                New goods receipt
              </Button>
            )
          }
        />
      )}

      {receipts.data && receipts.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.data.map((receipt) => (
              <TableRow
                key={receipt.id}
                className="cursor-pointer"
                onClick={() => void navigate(`/apps/goods-receipts/${receipt.id}`)}
              >
                <TableCell className="font-medium">
                  {receipt.receiptNumber}
                  {receipt.reversalOfId && (
                    <Badge variant="muted" className="ml-2">
                      Reversal
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {supplierNameById.get(receipt.supplierId) ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={RECEIPT_STATUS_VARIANT[receipt.status]}>{receipt.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{receipt.items.length}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(receipt.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
