import * as React from 'react';
import type { WarehouseDto } from '@inventory-ms/contracts';
import { FormDialog } from '@/components/data/FormDialog';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { errorMessage } from '@/lib/errorMessage';
import { useWarehouses } from './api';

interface WarehouseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: WarehouseDto;
}

export function WarehouseFormDialog({ open, onOpenChange, warehouse }: WarehouseFormDialogProps) {
  const { create, update } = useWarehouses();
  const isEdit = Boolean(warehouse);
  const mutation = isEdit ? update : create;

  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [isDefault, setIsDefault] = React.useState(false);
  const [errors, setErrors] = React.useState<{ code?: string; name?: string }>({});

  React.useEffect(() => {
    if (!open) return;
    setCode(warehouse?.code ?? '');
    setName(warehouse?.name ?? '');
    setAddress(warehouse?.address ?? '');
    setIsDefault(warehouse?.isDefault ?? false);
    setErrors({});
  }, [open, warehouse]);

  const handleSubmit = () => {
    const nextErrors: typeof errors = {};
    if (!isEdit && !/^[A-Za-z0-9_-]{1,32}$/.test(code.trim())) {
      nextErrors.code = 'Use up to 32 letters, digits, dashes, or underscores.';
    }
    if (name.trim().length === 0) nextErrors.name = 'Name is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const promise = isEdit
      ? update.mutateAsync({
          id: warehouse!.id,
          payload: { name: name.trim(), address: address.trim() || null, isDefault },
        })
      : create.mutateAsync({
          code: code.trim(),
          name: name.trim(),
          address: address.trim() || null,
          isDefault,
        });

    void promise.then(() => onOpenChange(false));
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit warehouse' : 'New warehouse'}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create warehouse'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="warehouse-code">Code</Label>
          <Input id="warehouse-code" value={code} onChange={(event) => setCode(event.target.value)} aria-invalid={Boolean(errors.code)} />
          <FieldError message={errors.code} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="warehouse-name">Name</Label>
        <Input id="warehouse-name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} />
        <FieldError message={errors.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="warehouse-address">Address</Label>
        <Textarea id="warehouse-address" value={address} onChange={(event) => setAddress(event.target.value)} rows={2} />
      </div>
      <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
        <div>
          <Label htmlFor="warehouse-default">Default warehouse</Label>
          <p className="text-xs text-muted-foreground">Used as the default destination for new receipts.</p>
        </div>
        <Switch id="warehouse-default" checked={isDefault} onCheckedChange={setIsDefault} />
      </div>
    </FormDialog>
  );
}
