import * as React from 'react';
import type { SupplierDto } from '@inventory-ms/contracts';
import { FormDialog } from '@/components/data/FormDialog';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/errorMessage';
import { useSuppliers } from './api';

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierDto | undefined;
}

export function SupplierFormDialog({ open, onOpenChange, supplier }: SupplierFormDialogProps) {
  const { create, update } = useSuppliers();
  const isEdit = Boolean(supplier);
  const mutation = isEdit ? update : create;

  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [addressLine, setAddressLine] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [taxIdentifier, setTaxIdentifier] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [errors, setErrors] = React.useState<{ code?: string; name?: string; email?: string }>({});

  React.useEffect(() => {
    if (!open) return;
    setCode(supplier?.code ?? '');
    setName(supplier?.name ?? '');
    setAddressLine(supplier?.addressLine ?? '');
    setPhone(supplier?.phone ?? '');
    setEmail(supplier?.email ?? '');
    setTaxIdentifier(supplier?.taxIdentifier ?? '');
    setNotes(supplier?.notes ?? '');
    setErrors({});
  }, [open, supplier]);

  const handleSubmit = () => {
    const nextErrors: typeof errors = {};
    if (!isEdit && !/^[A-Za-z0-9_-]{1,32}$/.test(code.trim())) {
      nextErrors.code = 'Use up to 32 letters, digits, dashes, or underscores.';
    }
    if (name.trim().length === 0) nextErrors.name = 'Name is required.';
    if (email.trim().length > 0 && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const shared = {
      name: name.trim(),
      addressLine: addressLine.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      taxIdentifier: taxIdentifier.trim() || null,
      notes: notes.trim() || null,
    };

    const promise = supplier
      ? update.mutateAsync({ id: supplier.id, payload: shared })
      : create.mutateAsync({ ...shared, code: code.trim() });

    void promise.then(() => { onOpenChange(false); });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit supplier' : 'New supplier'}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create supplier'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      <div className="grid grid-cols-2 gap-4">
        {!isEdit && (
          <div className="space-y-1.5">
            <Label htmlFor="supplier-code">Code</Label>
            <Input id="supplier-code" value={code} onChange={(event) => { setCode(event.target.value); }} aria-invalid={Boolean(errors.code)} />
            <FieldError message={errors.code} />
          </div>
        )}
        <div className={isEdit ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
          <Label htmlFor="supplier-name">Name</Label>
          <Input id="supplier-name" value={name} onChange={(event) => { setName(event.target.value); }} aria-invalid={Boolean(errors.name)} />
          <FieldError message={errors.name} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supplier-address">Address</Label>
        <Textarea id="supplier-address" value={addressLine} onChange={(event) => { setAddressLine(event.target.value); }} rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="supplier-phone">Phone</Label>
          <Input id="supplier-phone" value={phone} onChange={(event) => { setPhone(event.target.value); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="supplier-email">Email</Label>
          <Input id="supplier-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); }} aria-invalid={Boolean(errors.email)} />
          <FieldError message={errors.email} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supplier-tax">Tax identifier</Label>
        <Input id="supplier-tax" value={taxIdentifier} onChange={(event) => { setTaxIdentifier(event.target.value); }} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supplier-notes">Notes</Label>
        <Textarea id="supplier-notes" value={notes} onChange={(event) => { setNotes(event.target.value); }} rows={2} />
      </div>
    </FormDialog>
  );
}
