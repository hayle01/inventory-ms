import * as React from 'react';
import { AlertTriangle, PackageX } from 'lucide-react';
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
import { EmptyState } from '@/components/data/EmptyState';
import { ForbiddenState } from '@/components/data/ForbiddenState';
import { usePermissions } from '@/features/auth/usePermissions';
import { useWarehouses } from '@/features/warehouses/api';
import { useLowStockReport } from './api';
import { StatCard } from './components/StatCard';
import { ReportTable, type ReportColumn } from './components/ReportTable';

const ALL = '__all__';

interface Row {
  productId: string;
  sku: string;
  name: string;
  warehouseName: string;
  onHandQuantity: string;
  availableQuantity: string;
  reorderLevel: string;
  severity: 'out' | 'low';
}

export function LowStockReportPage() {
  const { has } = usePermissions();
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = React.useState(ALL);

  const report = useLowStockReport({ warehouseId: warehouseId === ALL ? undefined : warehouseId });

  if (!has('reports.view')) return <ForbiddenState module="reports" />;

  const columns: ReportColumn<Row>[] = [
    {
      key: 'sku',
      header: 'SKU',
      render: (r) => <span className="font-mono text-xs">{r.sku}</span>,
    },
    { key: 'name', header: 'Product', render: (r) => r.name },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouseName },
    { key: 'onHand', header: 'On hand', align: 'right', render: (r) => r.onHandQuantity },
    { key: 'available', header: 'Available', align: 'right', render: (r) => r.availableQuantity },
    { key: 'reorder', header: 'Reorder level', align: 'right', render: (r) => r.reorderLevel },
    {
      key: 'severity',
      header: 'Status',
      render: (r) => (
        <Badge variant={r.severity === 'out' ? 'destructive' : 'warning'}>
          {r.severity === 'out' ? 'Out of stock' : 'Low stock'}
        </Badge>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Card>
        <CardContent className="flex flex-nowrap items-end gap-4 overflow-x-auto pt-6">
          <div className="space-y-1.5">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
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
        </CardContent>
      </Card>

      {report.isLoading && <Skeleton className="h-64" />}
      {report.isError && <ErrorState error={report.error} />}

      {report.data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard
              label="Out of stock"
              value={String(report.data.totals.outOfStockCount)}
              icon={PackageX}
              tone="destructive"
            />
            <StatCard
              label="Low stock"
              value={String(report.data.totals.lowStockCount)}
              icon={AlertTriangle}
              tone="warning"
            />
          </div>

          {report.data.rows.length === 0 ? (
            <EmptyState icon={PackageX} title="Nothing is low or out of stock" />
          ) : (
            <ReportTable
              columns={columns}
              rows={report.data.rows}
              getRowKey={(r) => `${r.productId}:${r.warehouseName}`}
            />
          )}
        </>
      )}
    </main>
  );
}
