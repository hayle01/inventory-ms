import { Decimal } from 'decimal.js';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  allocateLots,
  type AllocatableBalanceRow,
} from '../../src/modules/issues/domain/lotAllocation.js';

function row(overrides: Partial<AllocatableBalanceRow> = {}): AllocatableBalanceRow {
  return {
    balanceId: new Types.ObjectId(),
    locationId: new Types.ObjectId(),
    lotId: new Types.ObjectId(),
    availableQuantity: new Decimal(10),
    expiresAt: null,
    receivedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('allocateLots (FEFO/FIFO domain function)', () => {
  it('FEFO: picks the lot with the earliest expiry first, even if received later', () => {
    const earlyExpiry = row({
      availableQuantity: new Decimal(5),
      expiresAt: new Date('2026-06-01'),
      receivedAt: new Date('2026-02-01'),
    });
    const lateExpiry = row({
      availableQuantity: new Decimal(5),
      expiresAt: new Date('2026-12-01'),
      receivedAt: new Date('2026-01-01'),
    });

    const result = allocateLots([lateExpiry, earlyExpiry], new Decimal(5), 'fefo');

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.balanceId).toBe(earlyExpiry.balanceId);
    expect(result.shortfallQuantity.toString()).toBe('0');
  });

  it('FEFO: rows with a known expiry are consumed before rows without one', () => {
    const noExpiry = row({ availableQuantity: new Decimal(5), expiresAt: null });
    const withExpiry = row({
      availableQuantity: new Decimal(5),
      expiresAt: new Date('2026-06-01'),
    });

    const result = allocateLots([noExpiry, withExpiry], new Decimal(5), 'fefo');

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.balanceId).toBe(withExpiry.balanceId);
  });

  it('FIFO: ignores expiry and orders strictly by received date', () => {
    const receivedLater = row({
      availableQuantity: new Decimal(5),
      expiresAt: new Date('2026-01-01'),
      receivedAt: new Date('2026-03-01'),
    });
    const receivedEarlier = row({
      availableQuantity: new Decimal(5),
      expiresAt: new Date('2026-12-01'),
      receivedAt: new Date('2026-01-01'),
    });

    const result = allocateLots([receivedLater, receivedEarlier], new Decimal(5), 'fifo');

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.balanceId).toBe(receivedEarlier.balanceId);
  });

  it('spreads across multiple rows in order when one row is insufficient', () => {
    const first = row({ availableQuantity: new Decimal(3), receivedAt: new Date('2026-01-01') });
    const second = row({ availableQuantity: new Decimal(10), receivedAt: new Date('2026-02-01') });

    const result = allocateLots([second, first], new Decimal(8), 'fifo');

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]?.balanceId).toBe(first.balanceId);
    expect(result.lines[0]?.quantity.toString()).toBe('3');
    expect(result.lines[1]?.balanceId).toBe(second.balanceId);
    expect(result.lines[1]?.quantity.toString()).toBe('5');
    expect(result.allocatedQuantity.toString()).toBe('8');
  });

  it('reports a shortfall instead of throwing when rows cannot cover the request', () => {
    const only = row({ availableQuantity: new Decimal(4) });

    const result = allocateLots([only], new Decimal(10), 'fifo');

    expect(result.allocatedQuantity.toString()).toBe('4');
    expect(result.shortfallQuantity.toString()).toBe('6');
  });

  it('skips rows with zero or negative available quantity', () => {
    const empty = row({ availableQuantity: new Decimal(0) });
    const usable = row({ availableQuantity: new Decimal(5) });

    const result = allocateLots([empty, usable], new Decimal(5), 'fifo');

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.balanceId).toBe(usable.balanceId);
  });
});
