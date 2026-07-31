import * as React from 'react';
import { Building2, MoreHorizontal, Plus } from 'lucide-react';
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
import type { DepartmentDto } from '@inventory-ms/contracts';
import { useDepartments } from './api';
import { DepartmentFormDialog } from './DepartmentFormDialog';

export function DepartmentsPage() {
  const { has } = usePermissions();
  const { list, archive } = useDepartments();

  const [formOpen, setFormOpen] = React.useState(false);
  const [formDepartment, setFormDepartment] = React.useState<DepartmentDto | undefined>();
  const [archiveTarget, setArchiveTarget] = React.useState<DepartmentDto | undefined>();

  if (!has('departments.view')) return <ForbiddenState module="departments" />;

  const canManage = has('departments.manage');

  const openCreate = () => {
    setFormDepartment(undefined);
    setFormOpen(true);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Departments"
        description="The requesting units that draw stock from your warehouses."
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus />
              New department
            </Button>
          )
        }
      />

      {list.isLoading && <Skeleton className="h-64" />}
      {list.isError && <ErrorState error={list.error} />}

      {list.data && list.data.length === 0 && (
        <EmptyState icon={Building2} title="No departments yet" />
      )}

      {list.data && list.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((department) => (
              <TableRow key={department.id}>
                <TableCell className="font-mono text-xs">{department.code}</TableCell>
                <TableCell className="font-medium">{department.name}</TableCell>
                <TableCell>
                  <Badge variant={department.status === 'active' ? 'success' : 'muted'}>
                    {department.status}
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
                            setFormDepartment(department);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        {department.status === 'active' && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              setArchiveTarget(department);
                            }}
                          >
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

      <DepartmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        department={formDepartment}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(undefined);
        }}
        title="Archive department"
        description={`${archiveTarget?.name ?? 'This department'} will be archived and hidden from selection lists.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() =>
          archiveTarget ? archive.mutateAsync(archiveTarget.id) : Promise.resolve()
        }
      />
    </main>
  );
}
