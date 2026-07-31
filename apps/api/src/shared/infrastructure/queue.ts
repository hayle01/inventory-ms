import { Queue } from 'bullmq';
import { getRedisClient } from './redis.js';

const queues = new Map<string, Queue>();

function getQueue(name: string): Queue {
  let queue = queues.get(name);
  queue ??= new Queue(name, { connection: getRedisClient() });
  queues.set(name, queue);
  return queue;
}

export interface NotificationJobData {
  template: 'password-reset' | 'user-invite';
  toUserId: string;
  data: Record<string, string>;
}

/**
 * Enqueues work only after the caller's database transaction has committed.
 * Payloads carry IDs and short-lived tokens needed for delivery, never full
 * documents -- the worker looks up anything else it needs by ID.
 */
export async function enqueueNotification(job: NotificationJobData): Promise<void> {
  await getQueue('notifications').add(job.template, job, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 1000,
  });
}
