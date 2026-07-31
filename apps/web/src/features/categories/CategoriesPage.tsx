import * as React from 'react';
import { MoreHorizontal, Plus, Tags } from 'lucide-react';
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
import type { CategoryDto } from '@inventory-ms/contracts';
import { useCategories } from './api';
import { CategoryFormDialog } from './CategoryFormDialog';

export function CategoriesPage() {
  const { has } = usePermissions();
  const { list, archive } = useCategories();

  const [formOpen, setFormOpen] = React.useState(false);
  const [formCategory, setFormCategory] = React.useState<CategoryDto | undefined>();
  const [archiveTarget, setArchiveTarget] = React.useState<CategoryDto | undefined>();

  if (!has('categories.view')) return <ForbiddenState module="categories" />;

  const canManage = has('categories.manage');
  const nameById = new Map((list.data ?? []).map((entry) => [entry.id, entry.name]));

  const openCreate = () => {
    setFormCategory(undefined);
    setFormOpen(true);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Categories"
        description="Group products for reporting, browsing, and reorder rules."
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus />
              New category
            </Button>
          )
        }
      />

      {list.isLoading && <Skeleton className="h-64" />}
      {list.isError && <ErrorState error={list.error} />}

      {list.data && list.data.length === 0 && <EmptyState icon={Tags} title="No categories yet" />}

      {list.data && list.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-mono text-xs">{category.code}</TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {category.parentId ? (nameById.get(category.parentId) ?? '—') : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={category.status === 'active' ? 'success' : 'muted'}>
                    {category.status}
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
                            setFormCategory(category);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        {category.status === 'active' && (
                          <DropdownMenuItem variant="destructive" onSelect={() => setArchiveTarget(category)}>
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

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} category={formCategory} />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTarget(undefined)}
        title="Archive category"
        description={`${archiveTarget?.name ?? 'This category'} will be archived and hidden from selection lists.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => archive.mutateAsync(archiveTarget!.id)}
      />
    </main>
  );
}
