import * as React from 'react';
import type { Permission, RoleDto } from '@inventory-ms/contracts';
import { FormDialog } from '@/components/data/FormDialog';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { usePermissionCatalog } from '@/features/permissions/api';
import { errorMessage } from '@/lib/errorMessage';
import { useCreateRole, useUpdateRole } from './api';

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleDto | undefined;
}

export function RoleFormDialog({ open, onOpenChange, role }: RoleFormDialogProps) {
  const catalog = usePermissionCatalog();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [permissionNames, setPermissionNames] = React.useState<Set<Permission>>(new Set());
  const [nameError, setNameError] = React.useState<string | undefined>();
  const [permissionError, setPermissionError] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!open) return;
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setPermissionNames(new Set(role?.permissionNames ?? []));
    setNameError(undefined);
    setPermissionError(undefined);
  }, [open, role]);

  const isEdit = Boolean(role);
  const mutation = isEdit ? updateRole : createRole;

  const togglePermission = (permission: Permission) => {
    setPermissionNames((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
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

    void promise.then(() => { onOpenChange(false); });
  };

  const groups = React.useMemo(() => {
    const map = new Map<string, typeof catalog.data>();
    for (const entry of catalog.data ?? []) {
      const bucket = map.get(entry.module) ?? [];
      bucket.push(entry);
      map.set(entry.module, bucket);
    }
    return map;
  }, [catalog]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit role' : 'New role'}
      description="Roles bundle permissions that can be assigned to users."
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create role'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      <div className="space-y-1.5">
        <Label htmlFor="role-name">Name</Label>
        <Input id="role-name" value={name} onChange={(event) => { setName(event.target.value); }} aria-invalid={Boolean(nameError)} />
        <FieldError message={nameError} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="role-description">Description</Label>
        <Textarea
          id="role-description"
          value={description}
          onChange={(event) => { setDescription(event.target.value); }}
          rows={2}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Permissions</Label>
        <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
          {Array.from(groups).map(([moduleName, permissions]) => (
            <div key={moduleName} className="space-y-1.5">
              <p className="text-xs font-medium capitalize text-muted-foreground">
                {moduleName.replace(/_/g, ' ')}
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {permissions?.map((permission) => (
                  <label key={permission.name} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={permissionNames.has(permission.name)}
                      onCheckedChange={() => { togglePermission(permission.name); }}
                    />
                    <span className="font-mono text-xs">{permission.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <FieldError message={permissionError} />
      </div>
    </FormDialog>
  );
}
