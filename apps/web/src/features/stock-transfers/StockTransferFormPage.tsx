import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { TRANSFER_IN_TRANSIT_POLICIES, type TransferInTransitPolicy } from '@inventory-ms/contracts';
import { FormPage, FormSection } from '@/components/data/FormPage';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
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
import { useCreateStockTransfer } from './api';

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

interface LineItemDraft {
  key: string;
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: string;
  note: string;
}

function emptyLine(): LineItemDraft {
  return {
    key: crypto.randomUUID(),
    productId: '',
    sourceLocationId: '',
    destinationLocationId: '',
    quantity: '1',
    note: '',
  };
}

export function StockTransferFormPage() {
  const navigate = useNavigate();
  const warehouses = useWarehouses();
  const products = useProducts();
  const createStockTransfer = useCreateStockTransfer();

  const [sourceWarehouseId, setSourceWarehouseId] = React.useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = React.useState('');
  const [inTransitPolicy, setInTransitPolicy] =
    React.useState<TransferInTransitPolicy>('in_transit');
  const [notes, setNotes] = React.useState('');
  const [lines, setLines] = React.useState<LineItemDraft[]>([emptyLine()]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const sourceLocations = useStorageLocations(sourceWarehouseId || undefined);
  const destinationLocations = useStorageLocations(destinationWarehouseId || undefined);

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
    if (!sourceWarehouseId) nextErrors['sourceWarehouseId'] = 'Select a source warehouse.';
    if (!destinationWarehouseId)
      nextErrors['destinationWarehouseId'] = 'Select a destination warehouse.';

    lines.forEach((line, index) => {
      const key = `line-${String(index)}`;
      if (!line.productId) {
        nextErrors[key] = 'Select a product for every line.';
        return;
      }
      if (!line.sourceLocationId || !line.destinationLocationId) {
        nextErrors[key] = 'Select both a source and a destination location for every line.';
        return;
      }
      if (line.sourceLocationId === line.destinationLocationId) {
        nextErrors[key] = 'Source and destination locations must be different.';
        return;
      }
      if (!DECIMAL_PATTERN.test(line.quantity.trim()) || Number(line.quantity) <= 0) {
        nextErrors[key] = 'Enter a valid quantity greater than zero.';
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const items = lines.map((line) => ({
      productId: line.productId,
      sourceLocationId: line.sourceLocationId,
      destinationLocationId: line.destinationLocationId,
      quantity: line.quantity.trim(),
      note: line.note.trim() || null,
    }));

    void createStockTransfer
      .mutateAsync({
        sourceWarehouseId,
        destinationWarehouseId,
        inTransitPolicy,
        items,
        notes: notes.trim() || null,
      })
      .then((result) => void navigate(`/apps/stock-transfers/${result.id}`));
  };

  return (
    <FormPage
      title="New stock transfer"
      description="Move stock between warehouses or locations, either immediately or held in transit until received."
      backTo="/apps/stock-transfers"
      onSubmit={handleSubmit}
      submitLabel="Create draft"
      isSubmitting={createStockTransfer.isPending}
      errorMessage={createStockTransfer.isError ? errorMessage(createStockTransfer.error) : undefined}
    >
      <FormSection title="Transfer details">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Source warehouse</Label>
            <Select
              value={sourceWarehouseId}
              onValueChange={(value) => {
                setSourceWarehouseId(value);
              }}
            >
              <SelectTrigger aria-invalid={Boolean(errors['sourceWarehouseId'])}>
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
            <FieldError message={errors['sourceWarehouseId']} />
          </div>
          <div className="space-y-1.5">
            <Label>Destination warehouse</Label>
            <Select
              value={destinationWarehouseId}
              onValueChange={(value) => {
                setDestinationWarehouseId(value);
              }}
            >
              <SelectTrigger aria-invalid={Boolean(errors['destinationWarehouseId'])}>
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
            <FieldError message={errors['destinationWarehouseId']} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>In-transit policy</Label>
          <Select
            value={inTransitPolicy}
            onValueChange={(value) => {
              setInTransitPolicy(value as TransferInTransitPolicy);
            }}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSFER_IN_TRANSIT_POLICIES.map((policy) => (
                <SelectItem key={policy} value={policy}>
                  {policy === 'immediate'
                    ? 'Immediate -- posts both sides at once'
                    : 'In transit -- requires a separate receive step'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="trf-notes">Notes</Label>
          <Textarea
            id="trf-notes"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            rows={2}
          />
        </div>
      </FormSection>

      <FormSection title="Line items">
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
              <TableHead>Source location</TableHead>
              <TableHead>Destination location</TableHead>
              <TableHead>Quantity</TableHead>
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
                      value={line.sourceLocationId}
                      onValueChange={(value) => {
                        updateLine(line.key, { sourceLocationId: value });
                      }}
                      disabled={!sourceWarehouseId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Source" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceLocations.list.data?.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-36">
                    <Select
                      value={line.destinationLocationId}
                      onValueChange={(value) => {
                        updateLine(line.key, { destinationLocationId: value });
                      }}
                      disabled={!destinationWarehouseId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {destinationLocations.list.data?.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) => {
                        updateLine(line.key, { quantity: event.target.value });
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
