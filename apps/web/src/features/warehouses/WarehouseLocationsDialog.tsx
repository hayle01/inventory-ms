import * as React from 'react';
import { MapPin, MoreHorizontal, Plus } from 'lucide-react';
import type { StorageLocationDto, WarehouseDto } from '@inventory-ms/contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { EmptyState } from '@/components/data/EmptyState';
import { ErrorState } from '@/components/data/ErrorState';
import { ConfirmDialog } from '@/components/data/ConfirmDialog';
import { usePermissions } from '@/features/auth/usePermissions';
import { useStorageLocations } from './api';
import { StorageLocationFormDialog } from './StorageLocationFormDialog';

interface WarehouseLocationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse: WarehouseDto | undefined;
}

export function WarehouseLocationsDialog({ open, onOpenChange, warehouse }: WarehouseLocationsDialogProps) {
  const { has } = usePermissions();
  const { list, archive } = useStorageLocations(warehouse?.id);

  const [formOpen, setFormOpen] = React.useState(false);
  const [formLocation, setFormLocation] = React.useState<StorageLocationDto | undefined>();
  const [archiveTarget, setArchiveTarget] = React.useState<StorageLocationDto | undefined>();

  const canManage = has('locations.manage');

  const openCreate = () => {
    setFormLocation(undefined);
    setFormOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Storage locations — {warehouse?.name}</DialogTitle>
          <DialogDescription>Bins and zones inside this warehouse.</DialogDescription>
        </DialogHeader>

        {canManage && (
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreate}>
              <Plus />
              New location
            </Button>
          </div>
        )}

        {list.isLoading && <Skeleton className="h-40" />}
        {list.isError && <ErrorState error={list.error} />}

        {list.data && list.data.length === 0 && <EmptyState icon={MapPin} title="No locations yet" />}

        {list.data && list.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-mono text-xs">{location.code}</TableCell>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">
                    {location.locationType.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={location.status === 'active' ? 'success' : 'muted'}>
                      {location.status}
                    </Badge>
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
                              setFormLocation(location);
                              setFormOpen(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          {location.status === 'active' && (
                            <DropdownMenuItem variant="destructive" onSelect={() => setArchiveTarget(location)}>
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

        {warehouse && (
          <StorageLocationFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            warehouseId={warehouse.id}
            location={formLocation}
          />
        )}

        <ConfirmDialog
          open={Boolean(archiveTarget)}
          onOpenChange={(nextOpen) => !nextOpen && setArchiveTarget(undefined)}
          title="Archive location"
          description={`${archiveTarget?.name ?? 'This location'} will be archived and hidden from selection lists.`}
          confirmLabel="Archive"
          variant="destructive"
          onConfirm={() => archive.mutateAsync(archiveTarget!.id)}
        />
      </DialogContent>
    </Dialog>
  );
}
