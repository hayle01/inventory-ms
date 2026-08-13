import * as React from 'react';
import { ClipboardList, PackageMinus, Undo2 } from 'lucide-react';
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
import { useIssuesReport } from './api';
import { StatCard } from './components/StatCard';
import { ReportTable, type ReportColumn } from './components/ReportTable';

const ALL = '__all__';

interface Row {
  issueId: string;
  issueNumber: string;
  status: string;
  postedAt: string | null;
  pickedQuantity: string;
  returnedQuantity: string;
}

export function IssuesReportPage() {
  const { has } = usePermissions();
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = React.useState(ALL);

  const report = useIssuesReport({ warehouseId: warehouseId === ALL ? undefined : warehouseId });

  if (!has('reports.view')) return <ForbiddenState module="reports" />;

  const columns: ReportColumn<Row>[] = [
    { key: 'number', header: 'Issue number', render: (r) => r.issueNumber },
    { key: 'status', header: 'Status', render: (r) => <Badge variant="outline">{r.status}</Badge> },
    {
      key: 'postedAt',
      header: 'Posted',
      render: (r) => (r.postedAt ? new Date(r.postedAt).toLocaleDateString() : '—'),
    },
    { key: 'picked', header: 'Picked qty', align: 'right', render: (r) => r.pickedQuantity },
    { key: 'returned', header: 'Returned qty', align: 'right', render: (r) => r.returnedQuantity },
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label={`${String(report.data.summary.requestCount)} requests`}
              value={report.data.summary.requestedQuantity}
              icon={ClipboardList}
            />
            <StatCard
              label={`${String(report.data.summary.issueCount)} posted issues`}
              value={report.data.summary.issuedQuantity}
              icon={PackageMinus}
              tone="destructive"
            />
            <StatCard
              label={`${String(report.data.summary.returnCount)} posted returns`}
              value={report.data.summary.returnedQuantity}
              icon={Undo2}
              tone="success"
            />
          </div>

          <ReportTable columns={columns} rows={report.data.rows} getRowKey={(r) => r.issueId} />
        </>
      )}
    </main>
  );
}
