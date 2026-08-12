import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { STOCK_COUNT_SCOPES, type StockCountScope } from '@inventory-ms/contracts';
import { FormPage, FormSection } from '@/components/data/FormPage';
import { FieldError } from '@/components/data/FieldError';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
import { useCreateStockCount } from './api';

interface LineSelectorDraft {
  key: string;
  productId: string;
  locationId: string;
}

function emptyLine(): LineSelectorDraft {
  return { key: crypto.randomUUID(), productId: '', locationId: '' };
}

export function StockCountFormPage() {
  const navigate = useNavigate();
  const warehouses = useWarehouses();
  const products = useProducts();
  const createStockCount = useCreateStockCount();

  const [warehouseId, setWarehouseId] = React.useState('');
  const [scope, setScope] = React.useState<StockCountScope>('cycle');
  const [blindCount, setBlindCount] = React.useState(true);
  const [notes, setNotes] = React.useState('');
  const [lines, setLines] = React.useState<LineSelectorDraft[]>([emptyLine()]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const locations = useStorageLocations(warehouseId || undefined);

  const updateLine = (key: string, patch: Partial<LineSelectorDraft>) => {
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
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const items = lines.map((line) => ({
      productId: line.productId,
      locationId: line.locationId,
    }));

    void createStockCount
      .mutateAsync({ warehouseId, scope, blindCount, items, notes: notes.trim() || null })
      .then((result) => void navigate(`/apps/stock-counts/${result.id}`));
  };

  return (
    <FormPage
      title="New stock count"
      description="Snapshots the current system quantity for each line -- counted quantities are entered afterward, from the count's detail page."
      backTo="/apps/stock-counts"
      onSubmit={handleSubmit}
      submitLabel="Create count"
      isSubmitting={createStockCount.isPending}
      errorMessage={createStockCount.isError ? errorMessage(createStockCount.error) : undefined}
    >
      <FormSection title="Count details">
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
            <Label>Scope</Label>
            <Select
              value={scope}
              onValueChange={(value) => {
                setScope(value as StockCountScope);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_COUNT_SCOPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={blindCount}
            onChange={(event) => {
              setBlindCount(event.target.checked);
            }}
          />
          Blind count -- hide the system quantity from the counter until they submit
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="cnt-notes">Notes</Label>
          <Textarea
            id="cnt-notes"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            rows={2}
          />
        </div>
      </FormSection>

      <FormSection
        title="Lines to count"
        description="Pick which product/location combinations belong to this count."
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
