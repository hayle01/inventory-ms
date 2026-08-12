import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
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
import { EmptyState } from '@/components/data/EmptyState';
import { usePendingApprovals } from './api';

export function ApprovalsPage() {
  const navigate = useNavigate();
  const { isLoading, items } = usePendingApprovals();

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Approvals"
        description="Every submitted document across the system that's waiting on your approval, in one place. Open one to approve, reject, or review it on its own page."
      />

      {isLoading && <Skeleton className="h-64" />}

      {!isLoading && items.length === 0 && (
        <EmptyState icon={CheckCircle2} title="Nothing is waiting on your approval" />
      )}

      {!isLoading && items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={`${item.documentType}:${item.id}`}
                className="cursor-pointer"
                onClick={() => void navigate(item.href)}
              >
                <TableCell>
                  <Badge variant="outline">{item.documentType}</Badge>
                </TableCell>
                <TableCell className="font-medium">{item.number}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  <ClipboardCheck className="ml-auto size-4" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
