import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import {
  ADJUSTMENT_REASON_CODES,
  STOCK_STATES,
  type AdjustmentReasonCode,
  type StockState,
} from '@inventory-ms/contracts';
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
import { useWarehouses, useStorageLocations } from '@/features/warehouses/api';
import { useProducts } from '@/features/products/api';
import {
  useCreateStockAdjustment,
  useStockAdjustment,
  useUpdateStockAdjustment,
} from './api';

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

interface LineItemDraft {
  key: string;
  productId: string;
  locationId: string;
  stockState: StockState;
  quantityDelta: string;
  note: string;
}

function emptyLine(): LineItemDraft {
  return {
    key: crypto.randomUUID(),
    productId: '',
    locationId: '',
    stockState: 'available',
    quantityDelta: '1',
    note: '',
  };
}

export function StockAdjustmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const backTo = isEdit ? `/apps/stock-adjustments/${String(id)}` : '/apps/stock-adjustments';

  const stockAdjustment = useStockAdjustment(id);
  const warehouses = useWarehouses();
  const products = useProducts();
  const createStockAdjustment = useCreateStockAdjustment();
  const updateStockAdjustment = useUpdateStockAdjustment();
  const mutation = isEdit ? updateStockAdjustment : createStockAdjustment;
  const existing = stockAdjustment.data;

  const [warehouseId, setWarehouseId] = React.useState('');
  const [reasonCode, setReasonCode] = React.useState<AdjustmentReasonCode>('count_correction');
  const [evidenceNote, setEvidenceNote] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [lines, setLines] = React.useState<LineItemDraft[]>([emptyLine()]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const hydrated = React.useRef(false);

  const locations = useStorageLocations(warehouseId || undefined);

  React.useEffect(() => {
    if (hydrated.current) return;
    if (isEdit && !existing) return;

    hydrated.current = true;
    setWarehouseId(existing?.warehouseId ?? '');
    setReasonCode(existing?.reasonCode ?? 'count_correction');
    setEvidenceNote(existing?.evidenceNote ?? '');
    setNotes(existing?.notes ?? '');
    setLines(
      existing && existing.items.length > 0
        ? existing.items.map((item) => ({
            key: crypto.randomUUID(),
            productId: item.productId,
            locationId: item.locationId,
            stockState: item.stockState,
            quantityDelta: item.quantityDelta,
            note: item.note ?? '',
          }))
        : [emptyLine()],
    );
  }, [isEdit, existing]);

  if (isEdit && stockAdjustment.isLoading) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-96" />
      </main>
    );
  }

  if (isEdit && !stockAdjustment.isLoading && !existing) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-destructive">Stock adjustment not found.</p>
      </main>
    );
  }

  if (isEdit && existing && existing.status !== 'draft') {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Only draft stock adjustments can be edited. This adjustment is {existing.status}.
        </p>
        <Button variant="outline" size="sm" onClick={() => void navigate(backTo)}>
          Back to adjustment
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
      if (!line.locationId) {
        nextErrors[key] = 'Select a location for every line.';
        return;
      }
      if (!DECIMAL_PATTERN.test(line.quantityDelta.trim()) || Number(line.quantityDelta) === 0) {
        nextErrors[key] = 'Enter a non-zero delta (negative decreases stock, positive increases it).';
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const items = lines.map((line) => ({
      productId: line.productId,
      locationId: line.locationId,
      stockState: line.stockState,
      quantityDelta: line.quantityDelta.trim(),
      note: line.note.trim() || null,
    }));

    const shared = {
      warehouseId,
      reasonCode,
      items,
      evidenceNote: evidenceNote.trim() || null,
      notes: notes.trim() || null,
    };

    const promise = existing
      ? updateStockAdjustment.mutateAsync({ id: existing.id, payload: shared })
      : createStockAdjustment.mutateAsync(shared);

    void promise.then((result) => void navigate(`/apps/stock-adjustments/${result.id}`));
  };

  return (
    <FormPage
      title={isEdit ? `Edit ${existing?.adjustmentNumber ?? 'stock adjustment'}` : 'New stock adjustment'}
      description="Draft adjustments can be edited until they're submitted for approval."
      backTo={backTo}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create draft'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      <FormSection title="Adjustment details">
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
            <Label>Reason code</Label>
            <Select
              value={reasonCode}
              onValueChange={(value) => {
                setReasonCode(value as AdjustmentReasonCode);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASON_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adj-evidence">Evidence note</Label>
          <Textarea
            id="adj-evidence"
            value={evidenceNote}
            onChange={(event) => {
              setEvidenceNote(event.target.value);
            }}
            rows={2}
            placeholder="What supports this adjustment -- count sheet reference, photo description, incident report, etc."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adj-notes">Notes</Label>
          <Textarea
            id="adj-notes"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            rows={2}
          />
        </div>
      </FormSection>

      <FormSection
        title="Line items"
        description="Enter the signed delta -- negative decreases on-hand, positive increases it."
      >
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
              <TableHead>Location</TableHead>
              <TableHead>Stock state</TableHead>
              <TableHead>Delta</TableHead>
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
                            {product.sku} — {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-36">
                    <Select
                      value={line.locationId}
                      onValueChange={(value) => {
                        updateLine(line.key, { locationId: value });
                      }}
                      disabled={!warehouseId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.list.data?.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-32">
                    <Select
                      value={line.stockState}
                      onValueChange={(value) => {
                        updateLine(line.key, { stockState: value as StockState });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STOCK_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      value={line.quantityDelta}
                      onChange={(event) => {
                        updateLine(line.key, { quantityDelta: event.target.value });
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
