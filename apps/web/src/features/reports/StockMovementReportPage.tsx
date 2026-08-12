import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown, Download, TrendingDown, TrendingUp } from 'lucide-react';
import { STOCK_TRANSACTION_TYPES, type StockTransactionType } from '@inventory-ms/contracts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/data/ErrorState';
import { ForbiddenState } from '@/components/data/ForbiddenState';
import { usePermissions } from '@/features/auth/usePermissions';
import { useWarehouses } from '@/features/warehouses/api';
import { useStockMovementReport } from './api';
import { StatCard } from './components/StatCard';
import { ReportTable, type ReportColumn } from './components/ReportTable';
import { downloadCsv, type CsvColumn } from './lib/csv';

const ALL = '__all__';
const PER_PAGE = 50;

interface Row {
  id: string;
  transactionNumber: string;
  transactionType: StockTransactionType;
  transactionAt: string;
  productName: string;
  productSku: string;
  referenceNumber: string;
  quantity: string;
}

export function StockMovementReportPage() {
  const { has } = usePermissions();
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = React.useState(ALL);
  const [transactionType, setTransactionType] = React.useState(ALL);
  const [page, setPage] = React.useState(1);

  const report = useStockMovementReport({
    warehouseId: warehouseId === ALL ? undefined : warehouseId,
    transactionType: transactionType === ALL ? undefined : (transactionType as StockTransactionType),
    page,
    perPage: PER_PAGE,
  });

  if (!has('reports.view')) return <ForbiddenState module="reports" />;

  const columns: ReportColumn<Row>[] = [
    { key: 'when', header: 'When', render: (r) => new Date(r.transactionAt).toLocaleString() },
    { key: 'number', header: 'Transaction', render: (r) => <span className="font-mono text-xs">{r.transactionNumber}</span> },
    { key: 'type', header: 'Type', render: (r) => <Badge variant="outline" className="capitalize">{r.transactionType}</Badge> },
    { key: 'product', header: 'Product', render: (r) => `${r.productName} (${r.productSku})` },
    { key: 'reference', header: 'Reference', render: (r) => r.referenceNumber },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      render: (r) => (
        <span className={r.quantity.startsWith('-') ? 'text-destructive' : 'text-emerald-600'}>
          {r.quantity}
        </span>
      ),
    },
  ];

  const csvColumns: CsvColumn<Row>[] = [
    { header: 'When', value: (r) => r.transactionAt },
    { header: 'Transaction', value: (r) => r.transactionNumber },
    { header: 'Type', value: (r) => r.transactionType },
    { header: 'Product', value: (r) => `${r.productName} (${r.productSku})` },
    { header: 'Reference', value: (r) => r.referenceNumber },
    { header: 'Quantity', value: (r) => r.quantity },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        to="/apps/reports"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Stock movement"
        description="Every immutable ledger transaction, filterable by warehouse, type, and date."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={!report.data || report.data.rows.length === 0}
            onClick={() => {
              if (!report.data) return;
              downloadCsv('stock-movement-report', csvColumns, report.data.rows);
            }}
          >
            <Download />
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1.5">
            <Label>Warehouse</Label>
            <Select
              value={warehouseId}
              onValueChange={(value) => {
                setWarehouseId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All warehouses</SelectItem>
                {warehouses.list.data?.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Transaction type</Label>
            <Select
              value={transactionType}
              onValueChange={(value) => {
                setTransactionType(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {STOCK_TRANSACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {report.isLoading && <Skeleton className="h-64" />}
      {report.isError && <ErrorState error={report.error} />}

      {report.data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total in" value={report.data.summary.totalIn} icon={TrendingUp} tone="success" />
            <StatCard label="Total out" value={report.data.summary.totalOut} icon={TrendingDown} tone="destructive" />
            <StatCard label="Net" value={report.data.summary.net} icon={ArrowUpDown} />
          </div>

          <ReportTable columns={columns} rows={report.data.rows} getRowKey={(r) => r.id} />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={report.data.rows.length < PER_PAGE}
                onClick={() => {
                  setPage((p) => p + 1);
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
