import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PurchaseOrderDto } from '@inventory-ms/contracts';
import { FormDialog } from '@/components/data/FormDialog';
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
import { useSuppliers } from '@/features/suppliers/api';
import { useWarehouses } from '@/features/warehouses/api';
import { useProducts } from '@/features/products/api';
import { useCreatePurchaseOrder, useUpdatePurchaseOrder } from './api';

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

interface LineItemDraft {
  key: string;
  productId: string;
  orderedQuantity: string;
  unitCost: string;
  taxAmount: string;
  discountAmount: string;
}

function emptyLine(): LineItemDraft {
  return {
    key: crypto.randomUUID(),
    productId: '',
    orderedQuantity: '1',
    unitCost: '0',
    taxAmount: '0',
    discountAmount: '0',
  };
}

interface PurchaseOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder?: PurchaseOrderDto | undefined;
}

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: PurchaseOrderFormDialogProps) {
  const isEdit = Boolean(purchaseOrder);
  const suppliers = useSuppliers();
  const warehouses = useWarehouses();
  const products = useProducts();
  const createPO = useCreatePurchaseOrder();
  const updatePO = useUpdatePurchaseOrder();
  const mutation = isEdit ? updatePO : createPO;

  const [supplierId, setSupplierId] = React.useState('');
  const [warehouseId, setWarehouseId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [lines, setLines] = React.useState<LineItemDraft[]>([emptyLine()]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setSupplierId(purchaseOrder?.supplierId ?? '');
    setWarehouseId(purchaseOrder?.warehouseId ?? '');
    setNotes(purchaseOrder?.notes ?? '');
    setLines(
      purchaseOrder && purchaseOrder.items.length > 0
        ? purchaseOrder.items.map((item) => ({
            key: crypto.randomUUID(),
            productId: item.productId,
            orderedQuantity: item.orderedQuantity,
            unitCost: item.unitCost,
            taxAmount: item.taxAmount,
            discountAmount: item.discountAmount,
          }))
        : [emptyLine()],
    );
    setErrors({});
  }, [open, purchaseOrder]);

  const updateLine = (key: string, patch: Partial<LineItemDraft>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setLines((current) =>
      current.length > 1 ? current.filter((line) => line.key !== key) : current,
    );
  };

  const productById = new Map((products.list.data ?? []).map((product) => [product.id, product]));

  const lineTotal = (line: LineItemDraft): number => {
    const quantity = Number.parseFloat(line.orderedQuantity) || 0;
    const cost = Number.parseFloat(line.unitCost) || 0;
    const tax = Number.parseFloat(line.taxAmount) || 0;
    const discount = Number.parseFloat(line.discountAmount) || 0;
    return quantity * cost + tax - discount;
  };

  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    if (!supplierId) nextErrors['supplierId'] = 'Select a supplier.';
    if (!warehouseId) nextErrors['warehouseId'] = 'Select a destination warehouse.';
    lines.forEach((line, index) => {
      if (!line.productId) nextErrors[`line-${String(index)}`] = 'Select a product for every line.';
      else if (
        !DECIMAL_PATTERN.test(line.orderedQuantity.trim()) ||
        Number(line.orderedQuantity) <= 0
      ) {
        nextErrors[`line-${String(index)}`] = 'Enter a positive quantity.';
      } else if (!DECIMAL_PATTERN.test(line.unitCost.trim())) {
        nextErrors[`line-${String(index)}`] = 'Enter a valid unit cost.';
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const items = lines.map((line) => ({
      productId: line.productId,
      orderedQuantity: line.orderedQuantity.trim(),
      unitCost: line.unitCost.trim(),
      taxAmount: line.taxAmount.trim() || '0',
      discountAmount: line.discountAmount.trim() || '0',
    }));

    const promise = purchaseOrder
      ? updatePO.mutateAsync({
          id: purchaseOrder.id,
          payload: { supplierId, warehouseId, items, notes: notes.trim() || null },
        })
      : createPO.mutateAsync({
          supplierId,
          warehouseId,
          items,
          notes: notes.trim() || null,
          currencyCode: 'USD',
        });

    void promise.then(() => {
      onOpenChange(false);
    });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit purchase order' : 'New purchase order'}
      description="Draft purchase orders can be edited until they're submitted for approval."
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create draft'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Supplier</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger aria-invalid={Boolean(errors['supplierId'])}>
              <SelectValue placeholder="Select a supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.list.data?.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors['supplierId']} />
        </div>
        <div className="space-y-1.5">
          <Label>Destination warehouse</Label>
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
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Line items</Label>
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
              <TableHead>Qty</TableHead>
              <TableHead>Unit cost</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => (
              <TableRow key={line.key}>
                <TableCell className="min-w-40">
                  <Select
                    value={line.productId}
                    onValueChange={(value) => {
                      updateLine(line.key, { productId: value });
                    }}
                  >
                    <SelectTrigger aria-invalid={Boolean(errors[`line-${String(index)}`])}>
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
                <TableCell>
                  <Input
                    className="w-20"
                    inputMode="decimal"
                    value={line.orderedQuantity}
                    onChange={(event) => {
                      updateLine(line.key, { orderedQuantity: event.target.value });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="w-24"
                    inputMode="decimal"
                    value={line.unitCost}
                    onChange={(event) => {
                      updateLine(line.key, { unitCost: event.target.value });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="w-20"
                    inputMode="decimal"
                    value={line.taxAmount}
                    onChange={(event) => {
                      updateLine(line.key, { taxAmount: event.target.value });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="w-20"
                    inputMode="decimal"
                    value={line.discountAmount}
                    onChange={(event) => {
                      updateLine(line.key, { discountAmount: event.target.value });
                    }}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {lineTotal(line).toFixed(2)}
                  {productById.get(line.productId) ? '' : ''}
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
            ))}
          </TableBody>
        </Table>
        {Object.entries(errors)
          .filter(([key]) => key.startsWith('line-'))
          .map(([key, message]) => (
            <FieldError key={key} message={message} />
          ))}
        <p className="text-right text-sm font-medium">Estimated total: {total.toFixed(2)}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="po-notes">Notes</Label>
        <Textarea
          id="po-notes"
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
          rows={2}
        />
      </div>
    </FormDialog>
  );
}
