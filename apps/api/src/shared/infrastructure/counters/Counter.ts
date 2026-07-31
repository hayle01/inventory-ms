import { Schema, model, type ClientSession, type Model } from 'mongoose';

interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>(
  { _id: String, seq: Number },
  { collection: 'counters' },
);

const CounterModel: Model<CounterDoc> = model<CounterDoc>('Counter', counterSchema);

/**
 * Atomically allocates the next sequence number for `name` (scoped by
 * caller, e.g. `${organizationId}:purchaseOrder`). Pass the transaction
 * session so document-number allocation and the document write commit or
 * roll back together.
 */
export async function nextSequence(name: string, session: ClientSession): Promise<number> {
  const updated = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  );
  return updated.seq;
}

export function formatSequence(prefix: string, seq: number, padding = 6): string {
  return `${prefix}-${String(seq).padStart(padding, '0')}`;
}
