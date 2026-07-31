import { describe, expect, it } from 'vitest';
import { QUEUE_NAMES } from '../src/queues/queueNames.js';

describe('QUEUE_NAMES', () => {
  it('has unique, non-empty queue names', () => {
    const values = Object.values(QUEUE_NAMES);
    expect(new Set(values).size).toBe(values.length);
    for (const name of values) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
