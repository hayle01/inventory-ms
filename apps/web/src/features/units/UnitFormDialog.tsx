import * as React from 'react';
import type { UnitDto } from '@inventory-ms/contracts';
import { FormDialog } from '@/components/data/FormDialog';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/errorMessage';
import { useUnits } from './api';

interface UnitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: UnitDto;
}

export function UnitFormDialog({ open, onOpenChange, unit }: UnitFormDialogProps) {
  const { create, update } = useUnits();
  const isEdit = Boolean(unit);
  const mutation = isEdit ? update : create;

  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [symbol, setSymbol] = React.useState('');
  const [decimalPlaces, setDecimalPlaces] = React.useState('0');
  const [errors, setErrors] = React.useState<{ code?: string; name?: string; symbol?: string }>({});

  React.useEffect(() => {
    if (!open) return;
    setCode(unit?.code ?? '');
    setName(unit?.name ?? '');
    setSymbol(unit?.symbol ?? '');
    setDecimalPlaces(String(unit?.decimalPlaces ?? 0));
    setErrors({});
  }, [open, unit]);

  const handleSubmit = () => {
    const nextErrors: typeof errors = {};
    if (!isEdit && !/^[A-Za-z0-9_-]{1,32}$/.test(code.trim())) {
      nextErrors.code = 'Use up to 32 letters, digits, dashes, or underscores.';
    }
    if (name.trim().length === 0) nextErrors.name = 'Name is required.';
    if (symbol.trim().length === 0) nextErrors.symbol = 'Symbol is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const parsedDecimalPlaces = Math.min(6, Math.max(0, Number.parseInt(decimalPlaces, 10) || 0));

    const promise = isEdit
      ? update.mutateAsync({
          id: unit!.id,
          payload: { name: name.trim(), symbol: symbol.trim(), decimalPlaces: parsedDecimalPlaces },
        })
      : create.mutateAsync({
          code: code.trim(),
          name: name.trim(),
          symbol: symbol.trim(),
          decimalPlaces: parsedDecimalPlaces,
        });

    void promise.then(() => onOpenChange(false));
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit unit' : 'New unit'}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create unit'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="unit-code">Code</Label>
          <Input id="unit-code" value={code} onChange={(event) => setCode(event.target.value)} aria-invalid={Boolean(errors.code)} />
          <FieldError message={errors.code} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="unit-name">Name</Label>
        <Input id="unit-name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} />
        <FieldError message={errors.name} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="unit-symbol">Symbol</Label>
          <Input id="unit-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} aria-invalid={Boolean(errors.symbol)} />
          <FieldError message={errors.symbol} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit-decimalPlaces">Decimal places</Label>
          <Input
            id="unit-decimalPlaces"
            type="number"
            min={0}
            max={6}
            value={decimalPlaces}
            onChange={(event) => setDecimalPlaces(event.target.value)}
          />
        </div>
      </div>
    </FormDialog>
  );
}
