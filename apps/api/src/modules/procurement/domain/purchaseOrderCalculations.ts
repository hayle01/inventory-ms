import { Decimal } from 'decimal.js';
import type { PurchaseOrderItemInput } from '@inventory-ms/contracts';

export interface CalculatedLine {
  quantity: Decimal;
  unitCost: Decimal;
  taxAmount: Decimal;
  discountAmount: Decimal;
  lineTotal: Decimal;
}

/**
 * Line total = (quantity * unitCost) + tax - discount. Computed server-side
 * from the submitted inputs -- client-supplied totals are never trusted.
 */
export function calculateLine(input: PurchaseOrderItemInput): CalculatedLine {
  const quantity = new Decimal(input.orderedQuantity);
  const unitCost = new Decimal(input.unitCost);
  const taxAmount = new Decimal(input.taxAmount);
  const discountAmount = new Decimal(input.discountAmount);
  const lineTotal = quantity.times(unitCost).plus(taxAmount).minus(discountAmount);
  return { quantity, unitCost, taxAmount, discountAmount, lineTotal };
}

export interface CalculatedTotals {
  subtotal: Decimal;
  taxTotal: Decimal;
  discountTotal: Decimal;
  total: Decimal;
}

export function calculateTotals(lines: readonly CalculatedLine[]): CalculatedTotals {
  let subtotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  let discountTotal = new Decimal(0);

  for (const line of lines) {
    subtotal = subtotal.plus(line.quantity.times(line.unitCost));
    taxTotal = taxTotal.plus(line.taxAmount);
    discountTotal = discountTotal.plus(line.discountAmount);
  }

  const total = subtotal.plus(taxTotal).minus(discountTotal);
  return { subtotal, taxTotal, discountTotal, total };
}
