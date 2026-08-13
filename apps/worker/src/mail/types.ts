/**
 * Mirrors `NotificationJobData` from `apps/api/src/shared/infrastructure/queue.ts`.
 * Duplicated rather than imported -- the worker and API are separate
 * deployable apps and don't depend on each other's source, only on the
 * shared `notifications` BullMQ queue name/job shape as a contract between
 * them. Keep this in sync if the API side changes.
 */
export interface NotificationJobData {
  template: 'password-reset' | 'user-invite';
  toUserId: string;
  data: Record<string, string>;
}
