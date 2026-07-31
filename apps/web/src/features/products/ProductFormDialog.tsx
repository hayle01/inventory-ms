import * as React from 'react';
import { PRODUCT_TYPES, type ProductDto, type ProductType } from '@inventory-ms/contracts';
import { X } from 'lucide-react';
import { FormDialog } from '@/components/data/FormDialog';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/errorMessage';
import { useCategories } from '@/features/categories/api';
import { useUnits } from '@/features/units/api';
import { useProducts } from './api';

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductDto | undefined;
}

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const { create, update } = useProducts();
  const categories = useCategories();
  const units = useUnits();
  const isEdit = Boolean(product);
  const mutation = isEdit ? update : create;

  const [sku, setSku] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [unitId, setUnitId] = React.useState('');
  const [productType, setProductType] = React.useState<ProductType>('other');
  const [purchasePrice, setPurchasePrice] = React.useState('0');
  const [issuePrice, setIssuePrice] = React.useState('');
  const [reorderLevel, setReorderLevel] = React.useState('0');
  const [reorderQuantity, setReorderQuantity] = React.useState('');
  const [trackLots, setTrackLots] = React.useState(false);
  const [trackExpiry, setTrackExpiry] = React.useState(false);
  const [expiryWarningDays, setExpiryWarningDays] = React.useState('90');
  const [allowNegativeStock, setAllowNegativeStock] = React.useState(false);
  const [barcodes, setBarcodes] = React.useState<string[]>([]);
  const [barcodeInput, setBarcodeInput] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setSku(product?.sku ?? '');
    setName(product?.name ?? '');
    setDescription(product?.description ?? '');
    setCategoryId(product?.categoryId ?? '');
    setUnitId(product?.unitId ?? '');
    setProductType(product?.productType ?? 'other');
    setPurchasePrice(product?.purchasePrice ?? '0');
    setIssuePrice(product?.issuePrice ?? '');
    setReorderLevel(product?.reorderLevel ?? '0');
    setReorderQuantity(product?.reorderQuantity ?? '');
    setTrackLots(product?.trackLots ?? false);
    setTrackExpiry(product?.trackExpiry ?? false);
    setExpiryWarningDays(String(product?.expiryWarningDays ?? 90));
    setAllowNegativeStock(product?.allowNegativeStock ?? false);
    setBarcodes(product?.barcodes ?? []);
    setBarcodeInput('');
    setErrors({});
  }, [open, product]);

  const addBarcode = () => {
    const value = barcodeInput.trim();
    if (value.length === 0 || barcodes.includes(value)) return;
    setBarcodes((current) => [...current, value]);
    setBarcodeInput('');
  };

  const removeBarcode = (value: string) => {
    setBarcodes((current) => current.filter((entry) => entry !== value));
  };

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    if (!isEdit && !/^[A-Za-z0-9_-]{1,32}$/.test(sku.trim())) {
      nextErrors['sku'] = 'Use up to 32 letters, digits, dashes, or underscores.';
    }
    if (name.trim().length === 0) nextErrors['name'] = 'Name is required.';
    if (!categoryId) nextErrors['categoryId'] = 'Select a category.';
    if (!unitId) nextErrors['unitId'] = 'Select a unit.';
    if (!DECIMAL_PATTERN.test(purchasePrice.trim())) nextErrors['purchasePrice'] = 'Enter a valid non-negative amount.';
    if (issuePrice.trim().length > 0 && !DECIMAL_PATTERN.test(issuePrice.trim())) {
      nextErrors['issuePrice'] = 'Enter a valid non-negative amount.';
    }
    if (!DECIMAL_PATTERN.test(reorderLevel.trim())) nextErrors['reorderLevel'] = 'Enter a valid non-negative quantity.';
    if (reorderQuantity.trim().length > 0 && !DECIMAL_PATTERN.test(reorderQuantity.trim())) {
      nextErrors['reorderQuantity'] = 'Enter a valid non-negative quantity.';
    }
    if (trackExpiry && !trackLots) nextErrors['trackExpiry'] = 'Expiry tracking requires lot tracking.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const shared = {
      categoryId,
      unitId,
      name: name.trim(),
      description: description.trim() || null,
      productType,
      purchasePrice: purchasePrice.trim(),
      issuePrice: issuePrice.trim() || null,
      reorderLevel: reorderLevel.trim(),
      reorderQuantity: reorderQuantity.trim() || null,
      trackLots,
      trackExpiry,
      expiryWarningDays: Number.parseInt(expiryWarningDays, 10) || 0,
      allowNegativeStock,
      barcodes,
    };

    const promise = product
      ? update.mutateAsync({ id: product.id, payload: shared })
      : create.mutateAsync({ ...shared, sku: sku.trim().toUpperCase() });

    void promise.then(() => { onOpenChange(false); });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit product' : 'New product'}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create product'}
      isSubmitting={mutation.isPending}
      errorMessage={mutation.isError ? errorMessage(mutation.error) : undefined}
    >
      <div className="grid grid-cols-2 gap-4">
        {!isEdit && (
          <div className="space-y-1.5">
            <Label htmlFor="product-sku">SKU</Label>
            <Input id="product-sku" value={sku} onChange={(event) => { setSku(event.target.value); }} aria-invalid={Boolean(errors['sku'])} />
            <FieldError message={errors['sku']} />
          </div>
        )}
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="product-name">Name</Label>
          <Input id="product-name" value={name} onChange={(event) => { setName(event.target.value); }} aria-invalid={Boolean(errors['name'])} />
          <FieldError message={errors['name']} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-description">Description</Label>
        <Textarea id="product-description" value={description} onChange={(event) => { setDescription(event.target.value); }} rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger aria-invalid={Boolean(errors['categoryId'])}>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.list.data?.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors['categoryId']} />
        </div>
        <div className="space-y-1.5">
          <Label>Unit</Label>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger aria-invalid={Boolean(errors['unitId'])}>
              <SelectValue placeholder="Select a unit" />
            </SelectTrigger>
            <SelectContent>
              {units.list.data?.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name} ({unit.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors['unitId']} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Product type</Label>
        <Select value={productType} onValueChange={(value) => { setProductType(value as ProductType); }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="product-purchasePrice">Purchase price</Label>
          <Input
            id="product-purchasePrice"
            inputMode="decimal"
            value={purchasePrice}
            onChange={(event) => { setPurchasePrice(event.target.value); }}
            aria-invalid={Boolean(errors['purchasePrice'])}
          />
          <FieldError message={errors['purchasePrice']} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product-issuePrice">Issue price (optional)</Label>
          <Input
            id="product-issuePrice"
            inputMode="decimal"
            value={issuePrice}
            onChange={(event) => { setIssuePrice(event.target.value); }}
            aria-invalid={Boolean(errors['issuePrice'])}
          />
          <FieldError message={errors['issuePrice']} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product-reorderLevel">Reorder level</Label>
          <Input
            id="product-reorderLevel"
            inputMode="decimal"
            value={reorderLevel}
            onChange={(event) => { setReorderLevel(event.target.value); }}
            aria-invalid={Boolean(errors['reorderLevel'])}
          />
          <FieldError message={errors['reorderLevel']} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product-reorderQuantity">Reorder quantity (optional)</Label>
          <Input
            id="product-reorderQuantity"
            inputMode="decimal"
            value={reorderQuantity}
            onChange={(event) => { setReorderQuantity(event.target.value); }}
            aria-invalid={Boolean(errors['reorderQuantity'])}
          />
          <FieldError message={errors['reorderQuantity']} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
          <Label htmlFor="product-trackLots">Track lots</Label>
          <Switch id="product-trackLots" checked={trackLots} onCheckedChange={(checked) => {
            setTrackLots(checked);
            if (!checked) setTrackExpiry(false);
          }} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
          <Label htmlFor="product-trackExpiry">Track expiry</Label>
          <Switch id="product-trackExpiry" checked={trackExpiry} onCheckedChange={setTrackExpiry} disabled={!trackLots} />
        </div>
        <FieldError message={errors['trackExpiry']} />
        {trackExpiry && (
          <div className="space-y-1.5">
            <Label htmlFor="product-expiryWarningDays">Expiry warning (days)</Label>
            <Input
              id="product-expiryWarningDays"
              type="number"
              min={0}
              value={expiryWarningDays}
              onChange={(event) => { setExpiryWarningDays(event.target.value); }}
            />
          </div>
        )}
        <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
          <Label htmlFor="product-allowNegativeStock">Allow negative stock</Label>
          <Switch id="product-allowNegativeStock" checked={allowNegativeStock} onCheckedChange={setAllowNegativeStock} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-barcode">Barcodes</Label>
        <div className="flex gap-2">
          <Input
            id="product-barcode"
            value={barcodeInput}
            onChange={(event) => { setBarcodeInput(event.target.value); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addBarcode();
              }
            }}
            placeholder="Scan or type a barcode"
          />
        </div>
        {barcodes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {barcodes.map((barcode) => (
              <Badge key={barcode} variant="secondary">
                {barcode}
                <button type="button" onClick={() => { removeBarcode(barcode); }} aria-label={`Remove ${barcode}`}>
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </FormDialog>
  );
}
