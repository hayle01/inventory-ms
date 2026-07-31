import type { Model } from 'mongoose';

/**
 * Central registry of Mongoose models used by `db:verify-indexes`. Each
 * module registers its own models here (e.g. from its `models/index.ts`)
 * instead of the migration runner reaching into module internals.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, Model<any>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerModel(name: string, model: Model<any>): void {
  registry.set(name, model);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listRegisteredModels(): ReadonlyMap<string, Model<any>> {
  return registry;
}
