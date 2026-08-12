import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, ArrowLeft, CalendarClock, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useExpiryReport } from './api';
import { StatCard } from './components/StatCard';
import { ReportTable, type ReportColumn } from './components/ReportTable';
import { downloadCsv, type CsvColumn } from './lib/csv';

const ALL = '__all__';

interface Row {
  lotId: string;
  lotNumber: string;
  sku: string;
  name: string;
  warehouseName: string;
  expiresAt: string;
  daysUntilExpiry: number;
  remainingQuantity: string;
  severity: 'expired' | 'critical' | 'warning';
}

const SEVERITY_VARIANT = {
  expired: 'destructive',
  critical: 'destructive',
  warning: 'warning',
} as const;

export function ExpiryReportPage() {
  const { has } = usePermissions();
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = React.useState(ALL);
  const [withinDays, setWithinDays] = React.useState('90');

  const report = useExpiryReport({
    warehouseId: warehouseId === ALL ? undefined : warehouseId,
    withinDays: Number(withinDays) || 90,
  });

  if (!has('reports.view')) return <ForbiddenState module="reports" />;

  const columns: ReportColumn<Row>[] = [
    { key: 'lot', header: 'Lot', render: (r) => r.lotNumber },
    { key: 'name', header: 'Product', render: (r) => `${r.name} (${r.sku})` },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouseName },
    { key: 'expiresAt', header: 'Expires', render: (r) => new Date(r.expiresAt).toLocaleDateString() },
    { key: 'days', header: 'Days', align: 'right', render: (r) => String(r.daysUntilExpiry) },
    { key: 'remaining', header: 'Remaining qty', align: 'right', render: (r) => r.remainingQuantity },
    {
      key: 'severity',
      header: 'Status',
      render: (r) => <Badge variant={SEVERITY_VARIANT[r.severity]} className="capitalize">{r.severity}</Badge>,
    },
  ];

  const csvColumns: CsvColumn<Row>[] = [
    { header: 'Lot', value: (r) => r.lotNumber },
    { header: 'Product', value: (r) => `${r.name} (${r.sku})` },
    { header: 'Warehouse', value: (r) => r.warehouseName },
    { header: 'Expires', value: (r) => r.expiresAt },
    { header: 'Days', value: (r) => r.daysUntilExpiry },
    { header: 'Remaining qty', value: (r) => r.remainingQuantity },
    { header: 'Status', value: (r) => r.severity },
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
        title="Expiring & expired stock"
        description="Active lots nearing or past their expiry date, with remaining issuable quantity."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={!report.data || report.data.rows.length === 0}
            onClick={() => {
              if (!report.data) return;
              downloadCsv('expiry-report', csvColumns, report.data.rows);
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
            <Label htmlFor="expiry-window">Within (days)</Label>
            <Input
              id="expiry-window"
              className="w-28"
              inputMode="numeric"
              value={withinDays}
              onChange={(event) => {
                setWithinDays(event.target.value);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {report.isLoading && <Skeleton className="h-64" />}
      {report.isError && <ErrorState error={report.error} />}

      {report.data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Expired" value={String(report.data.totals.expiredCount)} icon={AlertOctagon} tone="destructive" />
            <StatCard label="Critical (≤ 7 days)" value={String(report.data.totals.criticalCount)} icon={CalendarClock} tone="destructive" />
            <StatCard label="Warning" value={String(report.data.totals.warningCount)} icon={CalendarClock} tone="warning" />
          </div>

          {report.data.rows.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nothing expiring in this window" />
          ) : (
            <ReportTable columns={columns} rows={report.data.rows} getRowKey={(r) => r.lotId} />
          )}
        </>
      )}
    </main>
  );
}
