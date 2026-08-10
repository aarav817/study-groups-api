import { redis } from '../redis';
import crypto from 'crypto';

export interface JoinGroupEmailJob {
  id: string;
  type: 'JOIN_GROUP_EMAIL';
  groupId: string;
  groupTitle: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerName: string;
  joinedUserId: string;
  joinedUserName: string;
  attempts: number;
  createdAt: string;
}

export interface VerifyAccountEmailJob {
  id: string;
  type: 'VERIFY_ACCOUNT_EMAIL';
  userId: string;
  userEmail: string;
  userName: string;
  token: string;
  verificationUrl: string;
  attempts: number;
  createdAt: string;
}

export type EmailJob = JoinGroupEmailJob | VerifyAccountEmailJob;

const QUEUE_KEY = 'email_notifications_queue';
const FAILED_QUEUE_KEY = 'email_notifications_failed';

// In-memory fallback queue for offline/fallback mode
const inMemoryQueue: EmailJob[] = [];
const inMemoryFailedQueue: EmailJob[] = [];

/**
 * Enqueue a new group join email notification job.
 * Runs asynchronously and does not block the caller.
 */
export async function enqueueJoinNotification(jobPayload: Omit<JoinGroupEmailJob, 'id' | 'type' | 'attempts' | 'createdAt'>): Promise<EmailJob> {
  const job: EmailJob = {
    ...jobPayload,
    id: `job_${crypto.randomBytes(8).toString('hex')}`,
    type: 'JOIN_GROUP_EMAIL',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.lpush(QUEUE_KEY, JSON.stringify(job));
      console.log(`[Queue] Enqueued job ${job.id} into Redis list '${QUEUE_KEY}'.`);
      return job;
    }
  } catch (err) {
    // Fall back to in-memory queue
  }

  inMemoryQueue.unshift(job);
  console.log(`[Queue] Enqueued job ${job.id} into in-memory queue fallback.`);
  return job;
}

/**
 * Enqueue an account email verification job.
 */
export async function enqueueAccountVerification(jobPayload: Omit<VerifyAccountEmailJob, 'id' | 'type' | 'attempts' | 'createdAt'>): Promise<EmailJob> {
  const job: EmailJob = {
    ...jobPayload,
    id: `job_${crypto.randomBytes(8).toString('hex')}`,
    type: 'VERIFY_ACCOUNT_EMAIL',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.lpush(QUEUE_KEY, JSON.stringify(job));
      console.log(`[Queue] Enqueued account verification job ${job.id} into Redis list '${QUEUE_KEY}'.`);
      return job;
    }
  } catch (err) {
    // Fall back to in-memory queue
  }

  inMemoryQueue.unshift(job);
  console.log(`[Queue] Enqueued account verification job ${job.id} into in-memory queue fallback.`);
  return job;
}

/**
 * Re-enqueue a failed job for retry.
 */
export async function reenqueueJob(job: EmailJob): Promise<void> {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.lpush(QUEUE_KEY, JSON.stringify(job));
      console.log(`[Queue] Re-enqueued job ${job.id} for retry (attempt #${job.attempts}).`);
      return;
    }
  } catch (err) {
    // Fall back to in-memory queue
  }

  inMemoryQueue.unshift(job);
  console.log(`[Queue] Re-enqueued job ${job.id} into in-memory queue for retry (attempt #${job.attempts}).`);
}

/**
 * Move a job to the dead-letter queue after maximum retries are exhausted.
 */
export async function markJobAsFailed(job: EmailJob): Promise<void> {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.lpush(FAILED_QUEUE_KEY, JSON.stringify(job));
      console.error(`[Queue] Job ${job.id} moved to dead-letter queue '${FAILED_QUEUE_KEY}' after ${job.attempts} failed attempts.`);
      return;
    }
  } catch (err) {
    // Fall back to in-memory queue
  }

  inMemoryFailedQueue.unshift(job);
  console.error(`[Queue] Job ${job.id} moved to in-memory dead-letter queue after ${job.attempts} failed attempts.`);
}

/**
 * Pop the next job from the queue (non-blocking).
 */
export async function popJob(): Promise<EmailJob | null> {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      const data = await redis.rpop(QUEUE_KEY);
      if (data) {
        return JSON.parse(data) as EmailJob;
      }
    }
  } catch (err) {
    // Fall back to in-memory queue
  }

  if (inMemoryQueue.length > 0) {
    return inMemoryQueue.pop() || null;
  }
  return null;
}

/**
 * Get total pending queue length (Redis + Memory).
 */
export async function getQueueLength(): Promise<number> {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      const len = await redis.llen(QUEUE_KEY);
      return len;
    }
  } catch (err) {
    // Fall back
  }
  return inMemoryQueue.length;
}

/**
 * Get total failed dead-letter queue length.
 */
export async function getFailedQueueLength(): Promise<number> {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      const len = await redis.llen(FAILED_QUEUE_KEY);
      return len;
    }
  } catch (err) {
    // Fall back
  }
  return inMemoryFailedQueue.length;
}

/**
 * Clear queues (for test teardown).
 */
export async function clearQueues(): Promise<void> {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.del(QUEUE_KEY, FAILED_QUEUE_KEY);
    }
  } catch (err) {
    // Fall back
  }
  inMemoryQueue.length = 0;
  inMemoryFailedQueue.length = 0;
}

export default {
  enqueueJoinNotification,
  reenqueueJob,
  markJobAsFailed,
  popJob,
  getQueueLength,
  getFailedQueueLength,
  clearQueues,
};
