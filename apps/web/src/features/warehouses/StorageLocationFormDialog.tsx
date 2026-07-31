import * as React from 'react';
import { LOCATION_TYPES, type LocationType, type StorageLocationDto } from '@inventory-ms/contracts';
import { FormDialog } from '@/components/data/FormDialog';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/errorMessage';
import { useStorageLocations } from './api';

interface StorageLocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  location?: StorageLocationDto | undefined;
}

export function StorageLocationFormDialog({
  open,
  onOpenChange,
  warehouseId,
  location,
}: StorageLocationFormDialogProps) {
  const { create, update } = useStorageLocations(warehouseId);
  const isEdit = Boolean(location);
  const mutation = isEdit ? update : create;

  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [locationType, setLocationType] = React.useState<LocationType>('normal');
  const [errors, setErrors] = React.useState<{ code?: string; name?: string }>({});

  React.useEffect(() => {
    if (!open) return;
    setCode(location?.code ?? '');
    setName(location?.name ?? '');
    setLocationType(location?.locationType ?? 'normal');
    setErrors({});
  }, [open, location]);

  const handleSubmit = () => {
    const nextErrors: typeof errors = {};
    if (!isEdit && !/^[A-Za-z0-9_-]{1,32}$/.test(code.trim())) {
      nextErrors.code = 'Use up to 32 letters, digits, dashes, or underscores.';
    }
    if (name.trim().length === 0) nextErrors.name = 'Name is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const promise = location
      ? update.mutateAsync({ id: location.id, payload: { name: name.trim(), locationType } })
      : create.mutateAsync({ code: code.trim(), name: name.trim(), locationType });

    void promise.then(() => { onOpenChange(false); });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit location' : 'New location'}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create location'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="location-code">Code</Label>
          <Input id="location-code" value={code} onChange={(event) => { setCode(event.target.value); }} aria-invalid={Boolean(errors.code)} />
          <FieldError message={errors.code} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="location-name">Name</Label>
        <Input id="location-name" value={name} onChange={(event) => { setName(event.target.value); }} aria-invalid={Boolean(errors.name)} />
        <FieldError message={errors.name} />
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={locationType} onValueChange={(value) => { setLocationType(value as LocationType); }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCATION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </FormDialog>
  );
}
