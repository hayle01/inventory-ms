import * as React from 'react';
import type { DepartmentDto } from '@inventory-ms/contracts';
import { FormDialog } from '@/components/data/FormDialog';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/errorMessage';
import { useDepartments } from './api';

interface DepartmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: DepartmentDto | undefined;
}

export function DepartmentFormDialog({
  open,
  onOpenChange,
  department,
}: DepartmentFormDialogProps) {
  const { create, update } = useDepartments();
  const isEdit = Boolean(department);
  const mutation = isEdit ? update : create;

  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [codeError, setCodeError] = React.useState<string | undefined>();
  const [nameError, setNameError] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!open) return;
    setCode(department?.code ?? '');
    setName(department?.name ?? '');
    setCodeError(undefined);
    setNameError(undefined);
  }, [open, department]);

  const handleSubmit = () => {
    let hasError = false;
    if (!isEdit && !/^[A-Za-z0-9_-]{1,32}$/.test(code.trim())) {
      setCodeError('Use up to 32 letters, digits, dashes, or underscores.');
      hasError = true;
    } else {
      setCodeError(undefined);
    }
    if (name.trim().length === 0) {
      setNameError('Name is required.');
      hasError = true;
    } else {
      setNameError(undefined);
    }
    if (hasError) return;

    const promise = department
      ? update.mutateAsync({ id: department.id, payload: { name: name.trim() } })
      : create.mutateAsync({ code: code.trim(), name: name.trim() });

    void promise.then(() => {
      onOpenChange(false);
    });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit department' : 'New department'}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create department'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="department-code">Code</Label>
          <Input
            id="department-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            aria-invalid={Boolean(codeError)}
          />
          <FieldError message={codeError} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="department-name">Name</Label>
        <Input
          id="department-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          aria-invalid={Boolean(nameError)}
        />
        <FieldError message={nameError} />
      </div>
    </FormDialog>
  );
}
