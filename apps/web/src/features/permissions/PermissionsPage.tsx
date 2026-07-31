import type { PermissionDto } from '@inventory-ms/contracts';
import { KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Permissions"
        description="The full, read-only catalog of granular permissions available to roles and users."
      />

      {catalog.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      )}

      {catalog.isError && <ErrorState error={catalog.error} />}

      {catalog.data && catalog.data.length === 0 && (
        <EmptyState icon={KeyRound} title="No permissions found" />
      )}

      {catalog.data && catalog.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from(groupByModule(catalog.data)).map(([moduleName, permissions]) => (
            <Card key={moduleName}>
              <CardHeader>
                <CardTitle className="capitalize">{moduleName.replace(/_/g, ' ')}</CardTitle>
                <CardDescription>{permissions.length} permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {permissions.map((permission) => (
                  <div key={permission.name} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{permission.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{permission.description}</p>
                    </div>
                    <Badge variant={RISK_VARIANT[permission.riskLevel]}>{permission.riskLevel}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
