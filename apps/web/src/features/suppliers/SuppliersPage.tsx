import * as React from 'react';
import { MoreHorizontal, Plus, Truck } from 'lucide-react';
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
import type { SupplierDto } from '@inventory-ms/contracts';
import { useSuppliers } from './api';
import { SupplierFormDialog } from './SupplierFormDialog';

export function SuppliersPage() {
  const { has } = usePermissions();
  const { list, archive } = useSuppliers();

  const [formOpen, setFormOpen] = React.useState(false);
  const [formSupplier, setFormSupplier] = React.useState<SupplierDto | undefined>();
  const [archiveTarget, setArchiveTarget] = React.useState<SupplierDto | undefined>();

  if (!has('suppliers.view')) return <ForbiddenState module="suppliers" />;

  const canManage = has('suppliers.manage');

  const openCreate = () => {
    setFormSupplier(undefined);
    setFormOpen(true);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Suppliers"
        description="Vendors you purchase products from."
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus />
              New supplier
            </Button>
          )
        }
      />

      {list.isLoading && <Skeleton className="h-64" />}
      {list.isError && <ErrorState error={list.error} />}

      {list.data && list.data.length === 0 && <EmptyState icon={Truck} title="No suppliers yet" />}

      {list.data && list.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-mono text-xs">{supplier.code}</TableCell>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell className="text-muted-foreground">{supplier.phone ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{supplier.email ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={supplier.status === 'active' ? 'success' : 'muted'}>{supplier.status}</Badge>
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
                            setFormSupplier(supplier);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        {supplier.status === 'active' && (
                          <DropdownMenuItem variant="destructive" onSelect={() => { setArchiveTarget(supplier); }}>
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

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} supplier={formSupplier} />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
            if (!open) setArchiveTarget(undefined);
          }}
        title="Archive supplier"
        description={`${archiveTarget?.name ?? 'This supplier'} will be archived and hidden from selection lists.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => (archiveTarget ? archive.mutateAsync(archiveTarget.id) : Promise.resolve())}
      />
    </main>
  );
}
