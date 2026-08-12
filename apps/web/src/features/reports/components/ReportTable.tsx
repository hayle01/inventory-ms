import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface ReportColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

/** Generic, dense report table used across every report page for a consistent look -- header row, optional right-aligned numeric columns, optional totals footer row. */
export function ReportTable<T>({
  columns,
  rows,
  getRowKey,
  footer,
  emptyLabel = 'No rows match these filters.',
}: {
  columns: readonly ReportColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  footer?: ReactNode;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(column.align === 'right' && 'text-right')}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowKey(row)}>
              {columns.map((column) => (
                <TableCell key={column.key} className={cn(column.align === 'right' && 'text-right tabular-nums')}>
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {footer}
      </Table>
    </div>
  );
}
