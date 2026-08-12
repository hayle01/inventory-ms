import * as React from 'react';
import type { PermissionDto } from '@inventory-ms/contracts';
import { KeyRound, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ErrorState } from '@/components/data/ErrorState';
import { EmptyState } from '@/components/data/EmptyState';
import { usePermissionCatalog } from './api';

const RISK_VARIANT = {
  low: 'muted',
  medium: 'warning',
  high: 'destructive',
} as const;

function groupByModule(permissions: PermissionDto[]): Map<string, PermissionDto[]> {
  const groups = new Map<string, PermissionDto[]>();
  for (const permission of permissions) {
    const bucket = groups.get(permission.module) ?? [];
    bucket.push(permission);
    groups.set(permission.module, bucket);
  }
  return groups;
}

export function PermissionsPage() {
  const catalog = usePermissionCatalog();
  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    if (!catalog.data) return [];
    const query = search.trim().toLowerCase();
    if (!query) return catalog.data;
    return catalog.data.filter(
      (permission) =>
        permission.name.toLowerCase().includes(query) ||
        permission.description.toLowerCase().includes(query),
    );
  }, [catalog.data, search]);

  const grouped = React.useMemo(() => Array.from(groupByModule(filtered)), [filtered]);
  const counts = React.useMemo(() => {
    const byRisk = { low: 0, medium: 0, high: 0 };
    for (const permission of catalog.data ?? []) byRisk[permission.riskLevel] += 1;
    return byRisk;
  }, [catalog.data]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Permissions"
        description="The full, read-only catalog of granular permissions available to roles and users."
        actions={
          catalog.data && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="muted">{counts.low} low</Badge>
              <Badge variant="warning">{counts.medium} medium</Badge>
              <Badge variant="destructive">{counts.high} high</Badge>
            </div>
          )
        }
      />

      {catalog.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full max-w-sm" />
          <Skeleton className="h-96" />
        </div>
      )}

      {catalog.isError && <ErrorState error={catalog.error} />}

      {catalog.data && catalog.data.length === 0 && (
        <EmptyState icon={KeyRound} title="No permissions found" />
      )}

      {catalog.data && catalog.data.length > 0 && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search permissions…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>

          {grouped.length === 0 ? (
            <EmptyState icon={Search} title="No permissions match your search" />
          ) : (
            <Tabs defaultValue={grouped[0]?.[0] ?? ''}>
              <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
                {grouped.map(([moduleName, permissions]) => (
                  <TabsTrigger key={moduleName} value={moduleName} className="gap-1.5 px-3 py-1.5 capitalize">
                    {moduleName.replace(/_/g, ' ')}
                    <span className="text-xs text-muted-foreground">({permissions.length})</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {grouped.map(([moduleName, permissions]) => (
                <TabsContent key={moduleName} value={moduleName} className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Permission</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Risk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions.map((permission) => (
                        <TableRow key={permission.name}>
                          <TableCell className="font-mono text-xs">{permission.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {permission.description}
                          </TableCell>
                          <TableCell>
                            <Badge variant={RISK_VARIANT[permission.riskLevel]}>
                              {permission.riskLevel}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      )}
    </main>
  );
}
