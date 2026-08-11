import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Plus, Users as UsersIcon } from 'lucide-react';
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
import type { UserDto, UserStatus } from '@inventory-ms/contracts';
import { useActivateUser, useArchiveUser, useDeactivateUser, useUsers } from './api';

const STATUS_VARIANT: Record<UserStatus, 'success' | 'warning' | 'destructive' | 'muted'> = {
  active: 'success',
  invited: 'warning',
  locked: 'destructive',
  inactive: 'muted',
  archived: 'muted',
};

export function UsersPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const users = useUsers();
  const activateUser = useActivateUser();
  const deactivateUser = useDeactivateUser();
  const archiveUser = useArchiveUser();

  const [deactivateTarget, setDeactivateTarget] = React.useState<UserDto | undefined>();
  const [archiveTarget, setArchiveTarget] = React.useState<UserDto | undefined>();

  if (!has('users.view')) return <ForbiddenState module="users" />;

  const canCreate = has('users.create');
  const canUpdate = has('users.update');
  const canActivate = has('users.activate');
  const canDeactivate = has('users.deactivate');

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Users"
        description="People with access to this organization's workspace."
        actions={
          canCreate && (
            <Button onClick={() => void navigate('/apps/users/new')}>
              <Plus />
              New user
            </Button>
          )
        }
      />

      {users.isLoading && <Skeleton className="h-64" />}
      {users.isError && <ErrorState error={users.error} />}

      {users.data && users.data.length === 0 && (
        <EmptyState
          icon={UsersIcon}
          title="No users yet"
          description="Invite your team to start managing inventory together."
          action={
            canCreate && (
              <Button size="sm" onClick={() => void navigate('/apps/users/new')}>
                <Plus />
                New user
              </Button>
            )
          }
        />
      )}

      {users.data && users.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>MFA</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{user.username}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[user.status]}>{user.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.mfaEnabled ? 'Enabled' : '—'}
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
                          onSelect={() => void navigate(`/apps/users/${user.id}/edit`)}
                        >
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canActivate && user.status !== 'active' && user.status !== 'archived' && (
                        <DropdownMenuItem onSelect={() => void activateUser.mutateAsync(user.id)}>
                          Activate
                        </DropdownMenuItem>
                      )}
                      {canDeactivate && user.status === 'active' && (
                        <DropdownMenuItem
                          onSelect={() => {
                            setDeactivateTarget(user);
                          }}
                        >
                          Deactivate
                        </DropdownMenuItem>
                      )}
                      {canDeactivate && user.status !== 'archived' && (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            setArchiveTarget(user);
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
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(undefined);
        }}
        title="Deactivate user"
        description={`${deactivateTarget?.fullName ?? 'This user'} will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        reasonLabel="Reason (optional)"
        onConfirm={(reason) =>
          deactivateTarget
            ? deactivateUser.mutateAsync({ id: deactivateTarget.id, reason })
            : Promise.resolve()
        }
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(undefined);
        }}
        title="Archive user"
        description={`${archiveTarget?.fullName ?? 'This user'} will be archived and hidden from active lists. This does not delete their history.`}
        confirmLabel="Archive"
        variant="destructive"
        reasonLabel="Reason (optional)"
        onConfirm={(reason) =>
          archiveTarget
            ? archiveUser.mutateAsync({ id: archiveTarget.id, reason })
            : Promise.resolve()
        }
      />
    </main>
  );
}
