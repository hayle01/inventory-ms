import * as React from 'react';
import type { UserDto } from '@inventory-ms/contracts';
import { FormDialog } from '@/components/data/FormDialog';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDepartments } from '@/features/departments/api';
import { useWarehouses } from '@/features/warehouses/api';
import { useRoles } from '@/features/roles/api';
import { errorMessage } from '@/lib/errorMessage';
import { useCreateUser, useUpdateUser } from './api';

const NO_DEPARTMENT = '__none__';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserDto | undefined;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const isEdit = Boolean(user);
  const departments = useDepartments();
  const warehouses = useWarehouses();
  const roles = useRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const mutation = isEdit ? updateUser : createUser;

  const [fullName, setFullName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState<string>(NO_DEPARTMENT);
  const [warehouseScopeIds, setWarehouseScopeIds] = React.useState<Set<string>>(new Set());
  const [roleIds, setRoleIds] = React.useState<Set<string>>(new Set());
  const [errors, setErrors] = React.useState<{ fullName?: string; username?: string; email?: string }>({});

  React.useEffect(() => {
    if (!open) return;
    setFullName(user?.fullName ?? '');
    setUsername(user?.username ?? '');
    setEmail(user?.email ?? '');
    setDepartmentId(user?.departmentId ?? NO_DEPARTMENT);
    setWarehouseScopeIds(new Set(user?.warehouseScopeIds ?? []));
    setRoleIds(new Set(user?.roleIds ?? []));
    setErrors({});
  }, [open, user]);

  const toggleSet = (set: Set<string>, setter: (next: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const handleSubmit = () => {
    const nextErrors: typeof errors = {};
    if (fullName.trim().length === 0) nextErrors.fullName = 'Full name is required.';
    if (!isEdit && !/^[a-z0-9._-]{3,64}$/.test(username.trim())) {
      nextErrors.username = 'Use 3-64 lowercase letters, digits, dots, dashes, or underscores.';
    }
    if (!isEdit && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const departmentValue = departmentId === NO_DEPARTMENT ? null : departmentId;

    const promise = user
      ? updateUser.mutateAsync({
          id: user.id,
          payload: {
            fullName: fullName.trim(),
            departmentId: departmentValue,
            warehouseScopeIds: Array.from(warehouseScopeIds),
            roleIds: Array.from(roleIds),
          },
        })
      : createUser.mutateAsync({
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          departmentId: departmentValue,
          warehouseScopeIds: Array.from(warehouseScopeIds),
          roleIds: Array.from(roleIds),
        });

    void promise.then(() => { onOpenChange(false); });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit user' : 'New user'}
      description={isEdit ? 'Update profile, scope, and roles.' : 'Invite a new user to this organization.'}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create user'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      <div className="space-y-1.5">
        <Label htmlFor="user-fullName">Full name</Label>
        <Input
          id="user-fullName"
          value={fullName}
          onChange={(event) => { setFullName(event.target.value); }}
          aria-invalid={Boolean(errors.fullName)}
        />
        <FieldError message={errors.fullName} />
      </div>

      {!isEdit && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="user-username">Username</Label>
            <Input
              id="user-username"
              value={username}
              onChange={(event) => { setUsername(event.target.value); }}
              aria-invalid={Boolean(errors.username)}
            />
            <FieldError message={errors.username} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); }}
              aria-invalid={Boolean(errors.email)}
            />
            <FieldError message={errors.email} />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label>Department</Label>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger>
            <SelectValue placeholder="No department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEPARTMENT}>No department</SelectItem>
            {departments.list.data?.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Warehouse scope</Label>
        <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-md border border-input p-2">
          {(warehouses.list.data?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">No warehouses available.</p>
          )}
          {warehouses.list.data?.map((warehouse) => (
            <label key={warehouse.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={warehouseScopeIds.has(warehouse.id)}
                onCheckedChange={() => { toggleSet(warehouseScopeIds, setWarehouseScopeIds, warehouse.id); }}
              />
              {warehouse.name}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Roles</Label>
        <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-md border border-input p-2">
          {(roles.data?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">No roles available.</p>
          )}
          {roles.data?.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={roleIds.has(role.id)}
                onCheckedChange={() => { toggleSet(roleIds, setRoleIds, role.id); }}
              />
              {role.name}
            </label>
          ))}
        </div>
      </div>
    </FormDialog>
  );
}
