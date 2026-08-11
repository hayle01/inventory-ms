import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Package, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { useCategories } from '@/features/categories/api';
import type { ProductDto } from '@inventory-ms/contracts';
import { useProducts } from './api';

export function ProductsPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const { list, archive } = useProducts();
  const categories = useCategories();

  const [query, setQuery] = React.useState('');
  const [archiveTarget, setArchiveTarget] = React.useState<ProductDto | undefined>();

  if (!has('products.view')) return <ForbiddenState module="products" />;

  const canCreate = has('products.create');
  const canUpdate = has('products.update');
  const canArchive = has('products.archive');
  const categoryNameById = new Map(
    (categories.list.data ?? []).map((entry) => [entry.id, entry.name]),
  );

  const filtered = (list.data ?? []).filter((product) => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return true;
    return (
      product.name.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle)
    );
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Products"
        description="The catalog of items you receive, issue, and track stock for."
        actions={
          canCreate && (
            <Button onClick={() => void navigate('/apps/products/new')}>
              <Plus />
              New product
            </Button>
          )
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search by name or SKU"
          className="pl-9"
        />
      </div>

      {list.isLoading && <Skeleton className="h-64" />}
      {list.isError && <ErrorState error={list.error} />}

      {list.data && filtered.length === 0 && (
        <EmptyState
          icon={Package}
          title={query ? 'No products match your search' : 'No products yet'}
          action={
            !query &&
            canCreate && (
              <Button size="sm" onClick={() => void navigate('/apps/products/new')}>
                <Plus />
                New product
              </Button>
            )
          }
        />
      )}

      {filtered.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Purchase price</TableHead>
              <TableHead>Reorder level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {categoryNameById.get(product.categoryId) ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{product.purchasePrice}</TableCell>
                <TableCell className="text-muted-foreground">{product.reorderLevel}</TableCell>
                <TableCell>
                  <Badge variant={product.status === 'active' ? 'success' : 'muted'}>
                    {product.status}
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
                      {canUpdate && (
                        <DropdownMenuItem
                          onSelect={() => void navigate(`/apps/products/${product.id}/edit`)}
                        >
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canArchive && product.status !== 'archived' && (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            setArchiveTarget(product);
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

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(undefined);
        }}
        title="Archive product"
        description={`${archiveTarget?.name ?? 'This product'} will be archived and hidden from selection lists.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() =>
          archiveTarget ? archive.mutateAsync(archiveTarget.id) : Promise.resolve()
        }
      />
    </main>
  );
}
