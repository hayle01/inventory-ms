import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
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
import { ForbiddenState } from '@/components/data/ForbiddenState';
import { usePermissions } from '@/features/auth/usePermissions';
import { useAuditEvents } from './api';
import { ReportTable, type ReportColumn } from './components/ReportTable';

const ALL = '__all__';
const PER_PAGE = 25;

interface Row {
  id: string;
  createdAt: string;
  action: string;
  resourceType: string;
  resourceNumber: string | null;
  outcome: 'success' | 'denied' | 'failure';
  reason: string | null;
}

const OUTCOME_VARIANT = {
  success: 'success',
  denied: 'destructive',
  failure: 'destructive',
} as const;

export function AuditReportPage() {
  const { has } = usePermissions();
  const [resourceType, setResourceType] = React.useState('');
  const [outcome, setOutcome] = React.useState(ALL);
  const [page, setPage] = React.useState(1);

  const auditEvents = useAuditEvents({
    resourceType: resourceType.trim() || undefined,
    outcome: outcome === ALL ? undefined : outcome,
    page,
    perPage: PER_PAGE,
  });

  if (!has('audit.view')) return <ForbiddenState module="audit trail" />;

  const columns: ReportColumn<Row>[] = [
    { key: 'when', header: 'When', render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: 'action', header: 'Action', render: (r) => <span className="font-mono text-xs">{r.action}</span> },
    { key: 'resource', header: 'Resource', render: (r) => `${r.resourceType}${r.resourceNumber ? ` (${r.resourceNumber})` : ''}` },
    { key: 'outcome', header: 'Outcome', render: (r) => <Badge variant={OUTCOME_VARIANT[r.outcome]}>{r.outcome}</Badge> },
    { key: 'reason', header: 'Reason', render: (r) => r.reason ?? '—' },
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
        title="Audit trail"
        description="Actor, action, resource, outcome, and reason for every sensitive action -- including denied attempts."
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="audit-resource-type">Resource type</Label>
            <Input
              id="audit-resource-type"
              className="w-48"
              placeholder="e.g. stockIssue"
              value={resourceType}
              onChange={(event) => {
                setResourceType(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Outcome</Label>
            <Select
              value={outcome}
              onValueChange={(value) => {
                setOutcome(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All outcomes</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {auditEvents.isLoading && <Skeleton className="h-64" />}
      {auditEvents.isError && <ErrorState error={auditEvents.error} />}

      {auditEvents.data && (
        <>
          <ReportTable
            columns={columns}
            rows={auditEvents.data.data}
            getRowKey={(r) => r.id}
            emptyLabel="No audit events match these filters."
          />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {auditEvents.data.meta.total} event{auditEvents.data.meta.total === 1 ? '' : 's'} — page{' '}
              {auditEvents.data.meta.page}
            </p>
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
                disabled={!auditEvents.data.meta.hasNext}
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

      {auditEvents.data && auditEvents.data.data.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" />
          Try widening the filters above.
        </p>
      )}
    </main>
  );
}
