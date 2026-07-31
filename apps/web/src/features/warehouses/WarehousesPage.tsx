import * as React from 'react';
import { MapPin, MoreHorizontal, Plus, Warehouse as WarehouseIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
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
import type { WarehouseDto } from '@inventory-ms/contracts';
import { useWarehouses } from './api';
import { WarehouseFormDialog } from './WarehouseFormDialog';
import { WarehouseLocationsDialog } from './WarehouseLocationsDialog';

export function WarehousesPage() {
  const { has } = usePermissions();
  const { list, archive } = useWarehouses();

  const [formOpen, setFormOpen] = React.useState(false);
  const [formWarehouse, setFormWarehouse] = React.useState<WarehouseDto | undefined>();
  const [locationsWarehouse, setLocationsWarehouse] = React.useState<WarehouseDto | undefined>();
  const [locationsOpen, setLocationsOpen] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<WarehouseDto | undefined>();

  if (!has('warehouses.view')) return <ForbiddenState module="warehouses" />;

  const canManage = has('warehouses.manage');

  const openCreate = () => {
    setFormWarehouse(undefined);
    setFormOpen(true);
  };

  const openLocations = (warehouse: WarehouseDto) => {
    setLocationsWarehouse(warehouse);
    setLocationsOpen(true);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Warehouses"
        description="Physical storage sites and their internal bins and zones."
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus />
              New warehouse
            </Button>
          )
        }
      />

      {list.isLoading && <Skeleton className="h-64" />}
      {list.isError && <ErrorState error={list.error} />}

      {list.data && list.data.length === 0 && (
        <EmptyState icon={WarehouseIcon} title="No warehouses yet" />
      )}

      {list.data && list.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell className="font-mono text-xs">{warehouse.code}</TableCell>
                <TableCell className="font-medium">{warehouse.name}</TableCell>
                <TableCell>{warehouse.isDefault ? <Badge>Default</Badge> : '—'}</TableCell>
                <TableCell>
                  <Badge variant={warehouse.status === 'active' ? 'success' : 'muted'}>
                    {warehouse.status}
                  </Badge>
                </TableCell>
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
                          openLocations(warehouse);
                        }}
                      >
                        <MapPin />
                        Manage locations
                      </DropdownMenuItem>
                      {canManage && (
                        <DropdownMenuItem
                          onSelect={() => {
                            setFormWarehouse(warehouse);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canManage && warehouse.status === 'active' && (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            setArchiveTarget(warehouse);
                          }}
                        >
                          Archive
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <WarehouseFormDialog open={formOpen} onOpenChange={setFormOpen} warehouse={formWarehouse} />
      <WarehouseLocationsDialog
        open={locationsOpen}
        onOpenChange={setLocationsOpen}
        warehouse={locationsWarehouse}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(undefined);
        }}
        title="Archive warehouse"
        description={`${archiveTarget?.name ?? 'This warehouse'} will be archived and hidden from selection lists.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() =>
          archiveTarget ? archive.mutateAsync(archiveTarget.id) : Promise.resolve()
        }
      />
    </main>
  );
}
