import * as React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { RECEIPT_ITEM_CONDITIONS, type ReceiptItemCondition } from '@inventory-ms/contracts';
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
import { useSuppliers } from '@/features/suppliers/api';
import { useWarehouses, useStorageLocations } from '@/features/warehouses/api';
import { useProducts } from '@/features/products/api';
import { usePurchaseOrders } from '@/features/purchase-orders/api';
import { useCreateGoodsReceipt, useGoodsReceipt, useUpdateGoodsReceipt } from './api';

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;
const NO_PURCHASE_ORDER = '__none__';
const OPEN_PO_STATUSES = new Set(['approved', 'partially_received']);

interface LineItemDraft {
  key: string;
  productId: string;
  destinationLocationId: string;
  receivedQuantity: string;
  acceptedQuantity: string;
  unitCost: string;
  condition: ReceiptItemCondition;
  lotNumber: string;
  manufacturedAt: string;
  expiresAt: string;
  notes: string;
}

function emptyLine(): LineItemDraft {
  return {
    key: crypto.randomUUID(),
    productId: '',
    destinationLocationId: '',
    receivedQuantity: '1',
    acceptedQuantity: '1',
    unitCost: '0',
    condition: 'good',
    lotNumber: '',
    manufacturedAt: '',
    expiresAt: '',
    notes: '',
  };
}

function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function GoodsReceiptFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purchaseOrderIdFromQuery = searchParams.get('purchaseOrderId');
  const isEdit = Boolean(id);
  const backTo = isEdit ? `/apps/goods-receipts/${String(id)}` : '/apps/goods-receipts';

  const receipt = useGoodsReceipt(id);
  const suppliers = useSuppliers();
  const warehouses = useWarehouses();
  const products = useProducts();
  const purchaseOrders = usePurchaseOrders();
  const createReceipt = useCreateGoodsReceipt();
  const updateReceipt = useUpdateGoodsReceipt();
  const mutation = isEdit ? updateReceipt : createReceipt;
  const existing = receipt.data;

  const [supplierId, setSupplierId] = React.useState('');
  const [warehouseId, setWarehouseId] = React.useState('');
  const [purchaseOrderId, setPurchaseOrderId] = React.useState(NO_PURCHASE_ORDER);
  const [supplierDocumentNumber, setSupplierDocumentNumber] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [lines, setLines] = React.useState<LineItemDraft[]>([emptyLine()]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const hydrated = React.useRef(false);

  const locations = useStorageLocations(warehouseId || undefined);
  const productById = new Map((products.list.data ?? []).map((product) => [product.id, product]));

  React.useEffect(() => {
    if (hydrated.current) return;
    if (isEdit && !existing) return;

    if (!isEdit && purchaseOrderIdFromQuery) {
      if (!purchaseOrders.data) return; // wait for the PO list to load before prefilling
      const sourcePo = purchaseOrders.data.find((po) => po.id === purchaseOrderIdFromQuery);
      if (sourcePo) {
        hydrated.current = true;
        setSupplierId(sourcePo.supplierId);
        setWarehouseId(sourcePo.warehouseId);
        setPurchaseOrderId(sourcePo.id);
        const outstandingLines: LineItemDraft[] = sourcePo.items
          .filter((item) => Number(item.orderedQuantity) - Number(item.receivedQuantity) > 0)
          .map((item) => {
            const outstanding = (
              Number(item.orderedQuantity) - Number(item.receivedQuantity)
            ).toString();
            return {
              key: crypto.randomUUID(),
              productId: item.productId,
              destinationLocationId: '',
              receivedQuantity: outstanding,
              acceptedQuantity: outstanding,
              unitCost: item.unitCost,
              condition: 'good',
              lotNumber: '',
              manufacturedAt: '',
              expiresAt: '',
              notes: '',
            };
          });
        setLines(outstandingLines.length > 0 ? outstandingLines : [emptyLine()]);
        return;
      }
    }

    hydrated.current = true;
    setSupplierId(existing?.supplierId ?? '');
    setWarehouseId(existing?.warehouseId ?? '');
    setPurchaseOrderId(existing?.purchaseOrderId ?? NO_PURCHASE_ORDER);
    setSupplierDocumentNumber(existing?.supplierDocumentNumber ?? '');
    setNotes(existing?.notes ?? '');
    setLines(
      existing && existing.items.length > 0
        ? existing.items.map((item) => ({
            key: crypto.randomUUID(),
            productId: item.productId,
            destinationLocationId: item.destinationLocationId,
            receivedQuantity: item.receivedQuantity,
            acceptedQuantity: item.acceptedQuantity,
            unitCost: item.unitCost,
            condition: item.condition,
            lotNumber: item.lotNumber ?? '',
            manufacturedAt: item.manufacturedAt ? item.manufacturedAt.slice(0, 10) : '',
            expiresAt: item.expiresAt ? item.expiresAt.slice(0, 10) : '',
            notes: item.notes ?? '',
          }))
        : [emptyLine()],
    );
  }, [isEdit, existing, purchaseOrderIdFromQuery, purchaseOrders.data]);

  if (isEdit && receipt.isLoading) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-96" />
      </main>
    );
  }

  if (isEdit && !receipt.isLoading && !existing) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-destructive">Goods receipt not found.</p>
      </main>
    );
  }

  if (isEdit && existing && existing.status !== 'draft') {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Only draft goods receipts can be edited. This receipt is {existing.status}.
        </p>
        <Button variant="outline" size="sm" onClick={() => void navigate(backTo)}>
          Back to receipt
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

  const eligiblePurchaseOrders = (purchaseOrders.data ?? []).filter(
    (po) => OPEN_PO_STATUSES.has(po.status) && (!warehouseId || po.warehouseId === warehouseId),
  );

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    if (!supplierId) nextErrors['supplierId'] = 'Select a supplier.';
    if (!warehouseId) nextErrors['warehouseId'] = 'Select a warehouse.';

    lines.forEach((line, index) => {
      const key = `line-${String(index)}`;
      const product = productById.get(line.productId);
      if (!line.productId) {
        nextErrors[key] = 'Select a product for every line.';
        return;
      }
      if (!line.destinationLocationId) {
        nextErrors[key] = 'Select a destination location for every line.';
        return;
      }
      if (!DECIMAL_PATTERN.test(line.receivedQuantity.trim())) {
        nextErrors[key] = 'Enter a valid received quantity.';
        return;
      }
      if (!DECIMAL_PATTERN.test(line.acceptedQuantity.trim())) {
        nextErrors[key] = 'Enter a valid accepted quantity.';
        return;
      }
      if (Number(line.acceptedQuantity) > Number(line.receivedQuantity)) {
        nextErrors[key] = 'Accepted quantity cannot exceed received quantity.';
        return;
      }
      if (!DECIMAL_PATTERN.test(line.unitCost.trim())) {
        nextErrors[key] = 'Enter a valid unit cost.';
        return;
      }
      if (product && Number(line.acceptedQuantity) > 0) {
        if (product.trackLots && !line.lotNumber.trim()) {
          nextErrors[key] = `${product.sku} requires a lot number for accepted stock.`;
          return;
        }
        if (product.trackExpiry && !line.expiresAt) {
          nextErrors[key] = `${product.sku} requires an expiry date for accepted stock.`;
        }
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const items = lines.map((line) => {
      const received = Number(line.receivedQuantity.trim());
      const accepted = Number(line.acceptedQuantity.trim());
      const rejected = (received - accepted).toString();
      return {
        productId: line.productId,
        destinationLocationId: line.destinationLocationId,
        receivedQuantity: line.receivedQuantity.trim(),
        acceptedQuantity: line.acceptedQuantity.trim(),
        rejectedQuantity: rejected,
        unitCost: line.unitCost.trim(),
        condition: line.condition,
        lotNumber: line.lotNumber.trim() || null,
        manufacturedAt: toIsoDateTime(line.manufacturedAt),
        expiresAt: toIsoDateTime(line.expiresAt),
        notes: line.notes.trim() || null,
      };
    });

    const shared = {
      supplierId,
      warehouseId,
      purchaseOrderId: purchaseOrderId === NO_PURCHASE_ORDER ? null : purchaseOrderId,
      supplierDocumentNumber: supplierDocumentNumber.trim() || null,
      items,
      notes: notes.trim() || null,
    };

    const promise = existing
      ? updateReceipt.mutateAsync({ id: existing.id, payload: shared })
      : createReceipt.mutateAsync(shared);

    void promise.then((result) => void navigate(`/apps/goods-receipts/${result.id}`));
  };

  return (
    <FormPage
      title={isEdit ? `Edit ${existing?.receiptNumber ?? 'goods receipt'}` : 'New goods receipt'}
      description="Draft goods receipts can be edited until they're verified and posted."
      backTo={backTo}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create draft'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      <FormSection title="Receipt details">
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
            <Label>Warehouse</Label>
            <Select
              value={warehouseId}
              onValueChange={(value) => {
                setWarehouseId(value);
                setPurchaseOrderId(NO_PURCHASE_ORDER);
              }}
            >
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Purchase order (optional)</Label>
            <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
              <SelectTrigger>
                <SelectValue placeholder="Direct receipt (no PO)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PURCHASE_ORDER}>Direct receipt (no PO)</SelectItem>
                {eligiblePurchaseOrders.map((po) => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.poNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grn-supplier-doc">Supplier document number</Label>
            <Input
              id="grn-supplier-doc"
              value={supplierDocumentNumber}
              onChange={(event) => {
                setSupplierDocumentNumber(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="grn-notes">Notes</Label>
          <Textarea
            id="grn-notes"
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
        description="Only accepted quantity enters stock; the rest is treated as rejected."
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
              <TableHead>Destination</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Accepted</TableHead>
              <TableHead>Unit cost</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Lot</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => {
              const product = productById.get(line.productId);
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
                        {products.list.data?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.sku} — {p.name}
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
                    <Input
                      className="w-20"
                      inputMode="decimal"
                      value={line.receivedQuantity}
                      onChange={(event) => {
                        updateLine(line.key, { receivedQuantity: event.target.value });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-20"
                      inputMode="decimal"
                      value={line.acceptedQuantity}
                      onChange={(event) => {
                        updateLine(line.key, { acceptedQuantity: event.target.value });
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
                  <TableCell className="min-w-32">
                    <Select
                      value={line.condition}
                      onValueChange={(value) => {
                        updateLine(line.key, { condition: value as ReceiptItemCondition });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECEIPT_ITEM_CONDITIONS.map((condition) => (
                          <SelectItem key={condition} value={condition}>
                            {condition}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-28"
                      value={line.lotNumber}
                      onChange={(event) => {
                        updateLine(line.key, { lotNumber: event.target.value });
                      }}
                      placeholder={product?.trackLots ? 'Required' : 'Optional'}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-36"
                      type="date"
                      value={line.expiresAt}
                      onChange={(event) => {
                        updateLine(line.key, { expiresAt: event.target.value });
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
