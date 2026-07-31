/** Central registry of BullMQ queue names. Modules add to this as jobs are introduced. */
export const QUEUE_NAMES = {
  notifications: 'notifications',
  exports: 'exports',
  alertEvaluation: 'alert-evaluation',
  reconciliation: 'reconciliation',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
