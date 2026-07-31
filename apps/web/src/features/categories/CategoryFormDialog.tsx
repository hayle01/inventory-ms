import * as React from 'react';
import type { CategoryDto } from '@inventory-ms/contracts';
import { FormDialog } from '@/components/data/FormDialog';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/errorMessage';
import { useCategories } from './api';

const NO_PARENT = '__none__';

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryDto;
}

export function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const { list, create, update } = useCategories();
  const isEdit = Boolean(category);
  const mutation = isEdit ? update : create;

  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [parentId, setParentId] = React.useState<string>(NO_PARENT);
  const [codeError, setCodeError] = React.useState<string | undefined>();
  const [nameError, setNameError] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!open) return;
    setCode(category?.code ?? '');
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
    setParentId(category?.parentId ?? NO_PARENT);
    setCodeError(undefined);
    setNameError(undefined);
  }, [open, category]);

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

    const parentValue = parentId === NO_PARENT ? null : parentId;

    const promise = isEdit
      ? update.mutateAsync({
          id: category!.id,
          payload: { name: name.trim(), description: description.trim() || null, parentId: parentValue },
        })
      : create.mutateAsync({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || null,
          parentId: parentValue,
        });

    void promise.then(() => onOpenChange(false));
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit category' : 'New category'}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create category'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="category-code">Code</Label>
          <Input id="category-code" value={code} onChange={(event) => setCode(event.target.value)} aria-invalid={Boolean(codeError)} />
          <FieldError message={codeError} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="category-name">Name</Label>
        <Input id="category-name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(nameError)} />
        <FieldError message={nameError} />
      </div>
      <div className="space-y-1.5">
        <Label>Parent category</Label>
        <Select value={parentId} onValueChange={setParentId}>
          <SelectTrigger>
            <SelectValue placeholder="No parent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PARENT}>No parent</SelectItem>
            {list.data
              ?.filter((entry) => entry.id !== category?.id)
              .map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category-description">Description</Label>
        <Textarea
          id="category-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </div>
    </FormDialog>
  );
}
