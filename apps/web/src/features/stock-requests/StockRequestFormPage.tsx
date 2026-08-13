import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { FormPage, FormSection } from '@/components/data/FormPage';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/errorMessage';
import { useWarehouses } from '@/features/warehouses/api';
import { useProducts } from '@/features/products/api';
import { useCreateStockRequest, useStockRequest, useUpdateStockRequest } from './api';

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

interface LineItemDraft {
  key: string;
  productId: string;
  requestedQuantity: string;
  note: string;
}

function emptyLine(): LineItemDraft {
  return {
    key: crypto.randomUUID(),
    productId: '',
    requestedQuantity: '1',
    note: '',
  };
}

function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function StockRequestFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const backTo = isEdit ? `/apps/stock-requests/${String(id)}` : '/apps/stock-requests';

  const stockRequest = useStockRequest(id);
  const warehouses = useWarehouses();
  const products = useProducts();
  const createStockRequest = useCreateStockRequest();
  const updateStockRequest = useUpdateStockRequest();
  const mutation = isEdit ? updateStockRequest : createStockRequest;
  const existing = stockRequest.data;

  const [warehouseId, setWarehouseId] = React.useState('');
  const [neededBy, setNeededBy] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [lines, setLines] = React.useState<LineItemDraft[]>([emptyLine()]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const hydrated = React.useRef(false);

  const productById = new Map((products.list.data ?? []).map((product) => [product.id, product]));

  React.useEffect(() => {
    if (hydrated.current) return;
    if (isEdit && !existing) return;

    hydrated.current = true;
    setWarehouseId(existing?.warehouseId ?? '');
    setNeededBy(existing?.neededBy ? existing.neededBy.slice(0, 10) : '');
    setNotes(existing?.notes ?? '');
    setLines(
      existing && existing.items.length > 0
        ? existing.items.map((item) => ({
            key: crypto.randomUUID(),
            productId: item.productId,
            requestedQuantity: item.requestedQuantity,
            note: item.note ?? '',
          }))
        : [emptyLine()],
    );
  }, [isEdit, existing]);

  if (isEdit && stockRequest.isLoading) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-96" />
      </main>
    );
  }

  if (isEdit && !stockRequest.isLoading && !existing) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-destructive">Stock request not found.</p>
      </main>
    );
  }

  if (isEdit && existing && existing.status !== 'draft') {
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Only draft stock requests can be edited. This request is {existing.status}.
        </p>
        <Button variant="outline" size="sm" onClick={() => void navigate(backTo)}>
          Back to request
        </Button>
      </main>
    );
  }

  const updateLine = (key: string, patch: Partial<LineItemDraft>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setLines((current) =>
      current.length > 1 ? current.filter((line) => line.key !== key) : current,
    );
  };

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    if (!warehouseId) nextErrors['warehouseId'] = 'Select a warehouse.';

    lines.forEach((line, index) => {
      const key = `line-${String(index)}`;
      if (!line.productId) {
        nextErrors[key] = 'Select a product for every line.';
        return;
      }
      if (
        !DECIMAL_PATTERN.test(line.requestedQuantity.trim()) ||
        Number(line.requestedQuantity) <= 0
      ) {
        nextErrors[key] = 'Enter a valid requested quantity greater than zero.';
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const items = lines.map((line) => ({
      productId: line.productId,
      requestedQuantity: line.requestedQuantity.trim(),
      note: line.note.trim() || null,
    }));

    const shared = {
      warehouseId,
      neededBy: toIsoDateTime(neededBy),
      items,
      notes: notes.trim() || null,
    };

    const promise = existing
      ? updateStockRequest.mutateAsync({ id: existing.id, payload: shared })
      : createStockRequest.mutateAsync(shared);

    void promise.then((result) => void navigate(`/apps/stock-requests/${result.id}`));
  };

  return (
    <FormPage
      title={isEdit ? `Edit ${existing?.requestNumber ?? 'stock request'}` : 'New stock request'}
      description="Draft stock requests can be edited until they're submitted."
      backTo={backTo}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create draft'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      <FormSection title="Request details">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger aria-invalid={Boolean(errors['warehouseId'])}>
                <SelectValue placeholder="Select a warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.list.data?.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors['warehouseId']} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-needed-by">Needed by (optional)</Label>
            <Input
              id="req-needed-by"
              type="date"
              value={neededBy}
              onChange={(event) => {
                setNeededBy(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="req-notes">Notes</Label>
          <Textarea
            id="req-notes"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            rows={2}
          />
        </div>
      </FormSection>

      <FormSection title="Line items" description="What you need and how much of it.">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setLines((current) => [...current, emptyLine()]);
            }}
          >
            <Plus />
            Add line
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Requested quantity</TableHead>
              <TableHead>Note</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => {
              const lineError = errors[`line-${String(index)}`];
              return (
                <TableRow key={line.key}>
                  <TableCell className="min-w-40">
                    <Select
                      value={line.productId}
                      onValueChange={(value) => {
                        updateLine(line.key, { productId: value });
                      }}
                    >
                      <SelectTrigger aria-invalid={Boolean(lineError)}>
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.list.data?.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {productById.get(product.id)?.sku ?? product.sku} — {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      value={line.requestedQuantity}
                      onChange={(event) => {
                        updateLine(line.key, { requestedQuantity: event.target.value });
                      }}
                    />
                  </TableCell>
                  <TableCell className="min-w-40">
                    <Input
                      value={line.note}
                      onChange={(event) => {
                        updateLine(line.key, { note: event.target.value });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        removeLine(line.key);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {Object.entries(errors)
          .filter(([key]) => key.startsWith('line-'))
          .map(([key, message]) => (
            <FieldError key={key} message={message} />
          ))}
      </FormSection>
    </FormPage>
  );
}
