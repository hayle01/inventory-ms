import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Permission } from '@inventory-ms/contracts';
import { FormPage, FormSection } from '@/components/data/FormPage';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissionCatalog } from '@/features/permissions/api';
import { errorMessage } from '@/lib/errorMessage';
import { useCreateRole, useRoles, useUpdateRole } from './api';

const BACK_TO = '/apps/roles';

export function RoleFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const catalog = usePermissionCatalog();
  const roles = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const isEdit = Boolean(id);
  const role = id ? roles.data?.find((entry) => entry.id === id) : undefined;
  const mutation = isEdit ? updateRole : createRole;

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [permissionNames, setPermissionNames] = React.useState<Set<Permission>>(new Set());
  const [nameError, setNameError] = React.useState<string | undefined>();
  const [permissionError, setPermissionError] = React.useState<string | undefined>();
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    if (hydrated.current) return;
    if (isEdit && !role) return;
    hydrated.current = true;
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setPermissionNames(new Set(role?.permissionNames ?? []));
  }, [isEdit, role]);

  const groups = React.useMemo(() => {
    const map = new Map<string, typeof catalog.data>();
    for (const entry of catalog.data ?? []) {
      const bucket = map.get(entry.module) ?? [];
      bucket.push(entry);
      map.set(entry.module, bucket);
    }
    return map;
  }, [catalog]);

  if (isEdit && roles.isLoading) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-96" />
      </main>
    );
  }

  if (isEdit && !roles.isLoading && !role) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-destructive">Role not found.</p>
      </main>
    );
  }

  if (isEdit && role?.isSystem) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">System roles cannot be modified.</p>
        <Button variant="outline" size="sm" onClick={() => void navigate(BACK_TO)}>
          Back to roles
        </Button>
      </main>
    );
  }

  const togglePermission = (permission: Permission) => {
    setPermissionNames((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  };

  const toggleModule = (modulePermissions: Permission[], allChecked: boolean) => {
    setPermissionNames((current) => {
      const next = new Set(current);
      for (const permission of modulePermissions) {
        if (allChecked) next.delete(permission);
        else next.add(permission);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    setNameError(undefined);
    setPermissionError(undefined);

    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }
    if (permissionNames.size === 0) {
      setPermissionError('Select at least one permission.');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      permissionNames: Array.from(permissionNames),
    };

    const promise = role
      ? updateRole.mutateAsync({ id: role.id, payload })
      : createRole.mutateAsync(payload);

    void promise.then(() => void navigate(BACK_TO));
  };

  return (
    <FormPage
      title={isEdit ? `Edit ${role?.name ?? 'role'}` : 'New role'}
      description="Roles bundle permissions that can be assigned to users."
      backTo={BACK_TO}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create role'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      <FormSection title="Identity">
        <div className="space-y-1.5">
          <Label htmlFor="role-name">Name</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            aria-invalid={Boolean(nameError)}
          />
          <FieldError message={nameError} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role-description">Description</Label>
          <Textarea
            id="role-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            rows={2}
          />
        </div>
      </FormSection>

      <FormSection
        title="Permissions"
        description="Grouped by module. Selecting a module's checkbox toggles every permission in it."
      >
        <div className="space-y-5">
          {Array.from(groups).map(([moduleName, permissions]) => {
            const list = permissions ?? [];
            const allChecked =
              list.length > 0 && list.every((entry) => permissionNames.has(entry.name));
            return (
              <div key={moduleName} className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium capitalize">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={() => {
                      toggleModule(
                        list.map((entry) => entry.name),
                        allChecked,
                      );
                    }}
                  />
                  {moduleName.replace(/_/g, ' ')}
                  <Badge variant="muted">{list.length}</Badge>
                </label>
                <div className="grid grid-cols-1 gap-1.5 pl-6 sm:grid-cols-2">
                  {list.map((permission) => (
                    <label key={permission.name} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={permissionNames.has(permission.name)}
                        onCheckedChange={() => {
                          togglePermission(permission.name);
                        }}
                      />
                      <span className="font-mono text-xs">{permission.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <FieldError message={permissionError} />
      </FormSection>
    </FormPage>
  );
}
