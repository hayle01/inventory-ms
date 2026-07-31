import * as React from 'react';
import { MoreHorizontal, Plus, Ruler } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ErrorState } from '@/components/data/ErrorState';
import { EmptyState } from '@/components/data/EmptyState';
import { ForbiddenState } from '@/components/data/ForbiddenState';
import { ConfirmDialog } from '@/components/data/ConfirmDialog';
import { usePermissions } from '@/features/auth/usePermissions';
import type { UnitDto } from '@inventory-ms/contracts';
import { useUnits } from './api';
import { UnitFormDialog } from './UnitFormDialog';

export function UnitsPage() {
  const { has } = usePermissions();
  const { list, archive } = useUnits();

  const [formOpen, setFormOpen] = React.useState(false);
  const [formUnit, setFormUnit] = React.useState<UnitDto | undefined>();
  const [archiveTarget, setArchiveTarget] = React.useState<UnitDto | undefined>();

  if (!has('categories.view')) return <ForbiddenState module="units" />;

  const canManage = has('units.manage');

  const openCreate = () => {
    setFormUnit(undefined);
    setFormOpen(true);
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Units"
        description="Units of measure used when receiving, issuing, and counting stock."
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus />
              New unit
            </Button>
          )
        }
      />

      {list.isLoading && <Skeleton className="h-64" />}
      {list.isError && <ErrorState error={list.error} />}

      {list.data && list.data.length === 0 && <EmptyState icon={Ruler} title="No units yet" />}

      {list.data && list.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Decimals</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell className="font-mono text-xs">{unit.code}</TableCell>
                <TableCell className="font-medium">{unit.name}</TableCell>
                <TableCell className="text-muted-foreground">{unit.symbol}</TableCell>
                <TableCell className="text-muted-foreground">{unit.decimalPlaces}</TableCell>
                <TableCell>
                  <Badge variant={unit.status === 'active' ? 'success' : 'muted'}>{unit.status}</Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setFormUnit(unit);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        {unit.status === 'active' && (
                          <DropdownMenuItem variant="destructive" onSelect={() => { setArchiveTarget(unit); }}>
                            Archive
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <UnitFormDialog open={formOpen} onOpenChange={setFormOpen} unit={formUnit} />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
            if (!open) setArchiveTarget(undefined);
          }}
        title="Archive unit"
        description={`${archiveTarget?.name ?? 'This unit'} will be archived and hidden from selection lists.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => (archiveTarget ? archive.mutateAsync(archiveTarget.id) : Promise.resolve())}
      />
    </main>
  );
}
