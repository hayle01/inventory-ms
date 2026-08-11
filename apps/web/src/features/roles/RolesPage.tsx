import { useNavigate } from 'react-router-dom';
import { Lock, Pencil, Plus, ShieldCheck } from 'lucide-react';
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
import { ErrorState } from '@/components/data/ErrorState';
import { EmptyState } from '@/components/data/EmptyState';
import { ForbiddenState } from '@/components/data/ForbiddenState';
import { usePermissions } from '@/features/auth/usePermissions';
import { useRoles } from './api';

export function RolesPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const roles = useRoles();

  if (!has('roles.view')) return <ForbiddenState module="roles" />;

  const canManage = has('roles.manage');

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Roles"
        description="Bundles of permissions that can be assigned to users."
        actions={
          canManage && (
            <Button onClick={() => void navigate('/apps/roles/new')}>
              <Plus />
              New role
            </Button>
          )
        }
      />

      {roles.isLoading && <Skeleton className="h-64" />}
      {roles.isError && <ErrorState error={roles.error} />}

      {roles.data && roles.data.length === 0 && (
        <EmptyState
          icon={ShieldCheck}
          title="No roles yet"
          description="Create a role to bundle permissions for your team."
          action={
            canManage && (
              <Button size="sm" onClick={() => void navigate('/apps/roles/new')}>
                <Plus />
                New role
              </Button>
            )
          }
        />
      )}

      {roles.data && roles.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Type</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.data.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell className="text-muted-foreground">{role.description ?? '—'}</TableCell>
                <TableCell>{role.permissionNames.length}</TableCell>
                <TableCell>
                  {role.isSystem ? (
                    <Badge variant="muted">
                      <Lock />
                      System
                    </Badge>
                  ) : (
                    <Badge variant="outline">Custom</Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={role.isSystem}
                      onClick={() => void navigate(`/apps/roles/${role.id}/edit`)}
                    >
                      <Pencil />
                      Edit
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
