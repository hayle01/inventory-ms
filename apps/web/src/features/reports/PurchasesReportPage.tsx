import * as React from 'react';
import { PackageOpen, Receipt, Truck } from 'lucide-react';
import { PURCHASE_ORDER_STATUSES, type PurchaseOrderStatus } from '@inventory-ms/contracts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useSuppliers } from '@/features/suppliers/api';
import { usePurchasesReport } from './api';
import { StatCard } from './components/StatCard';
import { ReportTable, type ReportColumn } from './components/ReportTable';

const ALL = '__all__';

interface Row {
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  orderDate: string | null;
  total: string;
  orderedQuantity: string;
  receivedQuantity: string;
  outstandingQuantity: string;
}

export function PurchasesReportPage() {
  const { has } = usePermissions();
  const suppliers = useSuppliers();
  const [supplierId, setSupplierId] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);

  const report = usePurchasesReport({
    supplierId: supplierId === ALL ? undefined : supplierId,
    status: status === ALL ? undefined : (status as PurchaseOrderStatus),
  });

  if (!has('reports.view')) return <ForbiddenState module="reports" />;

  const columns: ReportColumn<Row>[] = [
    { key: 'po', header: 'PO number', render: (r) => r.poNumber },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplierName },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge variant="outline">{r.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'orderDate',
      header: 'Order date',
      render: (r) => (r.orderDate ? new Date(r.orderDate).toLocaleDateString() : '—'),
    },
    { key: 'total', header: 'Total', align: 'right', render: (r) => r.total },
    { key: 'ordered', header: 'Ordered', align: 'right', render: (r) => r.orderedQuantity },
    { key: 'received', header: 'Received', align: 'right', render: (r) => r.receivedQuantity },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      render: (r) => r.outstandingQuantity,
    },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Card>
        <CardContent className="flex flex-nowrap items-end gap-4 overflow-x-auto pt-6">
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All suppliers</SelectItem>
                {suppliers.list.data?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {PURCHASE_ORDER_STATUSES.map((value) => (
                  <SelectItem key={value} value={value} className="capitalize">
                    {value.replace('_', ' ')}
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
            <StatCard label="Total spend" value={report.data.totals.totalValue} icon={Receipt} />
            <StatCard
              label="Outstanding quantity"
              value={report.data.totals.totalOutstandingQuantity}
              icon={PackageOpen}
              tone="warning"
            />
            <StatCard
              label="Active suppliers"
              value={String(report.data.bySupplier.length)}
              icon={Truck}
            />
          </div>

          {report.data.bySupplier.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Supplier activity</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ReportTable
                  columns={[
                    { key: 'supplier', header: 'Supplier', render: (r) => r.supplierName },
                    {
                      key: 'count',
                      header: 'Purchase orders',
                      align: 'right',
                      render: (r) => String(r.purchaseOrderCount),
                    },
                    {
                      key: 'value',
                      header: 'Total value',
                      align: 'right',
                      render: (r) => r.totalValue,
                    },
                    {
                      key: 'outstanding',
                      header: 'Outstanding qty',
                      align: 'right',
                      render: (r) => r.totalOutstandingQuantity,
                    },
                  ]}
                  rows={report.data.bySupplier}
                  getRowKey={(r) => r.supplierId}
                />
              </CardContent>
            </Card>
          )}

          <ReportTable
            columns={columns}
            rows={report.data.rows}
            getRowKey={(r) => r.purchaseOrderId}
          />
        </>
      )}
    </main>
  );
}
