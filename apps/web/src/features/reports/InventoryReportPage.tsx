import * as React from 'react';
import { Boxes, PackageCheck, Warehouse } from 'lucide-react';
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
import { useCategories } from '@/features/categories/api';
import { useInventoryReport } from './api';
import { StatCard } from './components/StatCard';
import { ReportTable, type ReportColumn } from './components/ReportTable';

const ALL = '__all__';

interface Row {
  productId: string;
  sku: string;
  name: string;
  categoryName: string | null;
  warehouseName: string;
  onHandQuantity: string;
  reservedQuantity: string;
  availableQuantity: string;
  unitCost: string;
  valuation: string;
}

export function InventoryReportPage() {
  const { has } = usePermissions();
  const warehouses = useWarehouses();
  const categories = useCategories();
  const [warehouseId, setWarehouseId] = React.useState(ALL);
  const [categoryId, setCategoryId] = React.useState(ALL);

  const report = useInventoryReport({
    warehouseId: warehouseId === ALL ? undefined : warehouseId,
    categoryId: categoryId === ALL ? undefined : categoryId,
  });

  if (!has('reports.view')) return <ForbiddenState module="reports" />;

  const columns: ReportColumn<Row>[] = [
    {
      key: 'sku',
      header: 'SKU',
      render: (r) => <span className="font-mono text-xs">{r.sku}</span>,
    },
    { key: 'name', header: 'Product', render: (r) => r.name },
    { key: 'category', header: 'Category', render: (r) => r.categoryName ?? '—' },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouseName },
    { key: 'onHand', header: 'On hand', align: 'right', render: (r) => r.onHandQuantity },
    { key: 'reserved', header: 'Reserved', align: 'right', render: (r) => r.reservedQuantity },
    { key: 'available', header: 'Available', align: 'right', render: (r) => r.availableQuantity },
    { key: 'unitCost', header: 'Unit cost', align: 'right', render: (r) => r.unitCost },
    { key: 'valuation', header: 'Valuation', align: 'right', render: (r) => r.valuation },
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
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.list.data?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
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
            <StatCard
              label="Products"
              value={String(report.data.totals.productCount)}
              icon={Boxes}
            />
            <StatCard
              label="Total on hand"
              value={report.data.totals.onHandQuantity}
              icon={PackageCheck}
            />
            <StatCard
              label="Total valuation"
              value={report.data.totals.valuation}
              icon={Warehouse}
              tone="success"
            />
          </div>

          <ReportTable
            columns={columns}
            rows={report.data.rows}
            getRowKey={(r) => `${r.productId}:${r.warehouseName}`}
          />
        </>
      )}
    </main>
  );
}
