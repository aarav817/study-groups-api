import { popJob, reenqueueJob, markJobAsFailed, EmailJob } from '../queue/emailQueue';
import { sendGroupJoinNotification, sendAccountVerificationEmail } from '../services/emailService';

export class EmailWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private pollIntervalMs: number;
  private maxRetries: number;

  constructor(pollIntervalMs = 500, maxRetries = 3) {
    this.pollIntervalMs = pollIntervalMs;
    this.maxRetries = maxRetries;
  }

  /**
   * Start background worker processing loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[EmailWorker] Worker started. Polling queue every ${this.pollIntervalMs}ms with max ${this.maxRetries} retries.`);
    this.scheduleNextTick();
  }

  /**
   * Stop background worker.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[EmailWorker] Worker stopped.');
  }

  /**
   * Get current running status of the worker.
   */
  public getStatus(): { isRunning: boolean; pollIntervalMs: number; maxRetries: number } {
    return {
      isRunning: this.isRunning,
      pollIntervalMs: this.pollIntervalMs,
      maxRetries: this.maxRetries,
    };
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return;
    this.timer = setTimeout(async () => {
      this.notifyMetricsPoll();
      await this.processNextJob();
      this.scheduleNextTick();
    }, this.pollIntervalMs);
  }

  private notifyMetricsPoll(): void {
    try {
      const { redis } = require('../redis');
      if (redis.status === 'ready' || redis.status === 'connect') {
        redis.set('email_worker_heartbeat', Date.now().toString(), 'EX', 10).catch(() => {});
      }
    } catch (e) {}

    try {
      const { metricsCollector } = require('../utils/metrics');
      if (metricsCollector) {
        metricsCollector.recordWorkerPoll();
      }
    } catch (e) {}
  }

  private notifyMetricsJobSuccess(): void {
    try {
      const { metricsCollector } = require('../utils/metrics');
      if (metricsCollector) {
        metricsCollector.recordWorkerJobSuccess();
      }
    } catch (e) {}
  }

  private notifyMetricsJobFailure(): void {
    try {
      const { metricsCollector } = require('../utils/metrics');
      if (metricsCollector) {
        metricsCollector.recordWorkerJobFailure();
      }
    } catch (e) {}
  }

  /**
   * Process a single job from the queue.
   * Can also be called directly in unit tests for manual ticks.
   */
  public async processNextJob(): Promise<boolean> {
    let job: EmailJob | null = null;
    try {
      job = await popJob();
      if (!job) return false;

      if (job.type === 'JOIN_GROUP_EMAIL') {
        console.log(`[EmailWorker] Processing JOIN_GROUP_EMAIL job ${job.id} (Attempt #${job.attempts + 1}) for group '${job.groupTitle}'...`);
        await sendGroupJoinNotification(
          job.ownerEmail,
          job.ownerName,
          job.joinedUserName,
          job.groupTitle
        );
        console.log(`[EmailWorker] Successfully processed job ${job.id}. Email sent to owner ${job.ownerEmail}.`);
      } else if (job.type === 'VERIFY_ACCOUNT_EMAIL') {
        console.log(`[EmailWorker] Processing VERIFY_ACCOUNT_EMAIL job ${job.id} (Attempt #${job.attempts + 1}) for user '${job.userEmail}'...`);
        await sendAccountVerificationEmail(
          job.userEmail,
          job.userName,
          job.verificationUrl
        );
        console.log(`[EmailWorker] Successfully processed account verification job ${job.id} for ${job.userEmail}.`);
      }

      this.notifyMetricsJobSuccess();
      return true;
    } catch (err: any) {
      this.notifyMetricsJobFailure();
      if (job) {
        job.attempts += 1;
        console.error(`[EmailWorker] Error processing job ${job.id} (Attempt #${job.attempts}): ${err.message}`);

        if (job.attempts < this.maxRetries) {
          console.log(`[EmailWorker] Retrying job ${job.id} (${job.attempts}/${this.maxRetries})...`);
          await reenqueueJob(job);
        } else {
          console.error(`[EmailWorker] Job ${job.id} failed after ${job.attempts} attempts (max retries: ${this.maxRetries}). Moving to dead-letter queue.`);
          await markJobAsFailed(job);
        }
      }
      return false;
    }
  }
}

/**
 * Check if a background worker process is active (in-process or external standalone worker via Redis heartbeat).
 */
export async function isWorkerAlive(): Promise<boolean> {
  if (emailWorker.getStatus().isRunning) {
    return true;
  }
  try {
    const { redis } = require('../redis');
    if (redis.status === 'ready' || redis.status === 'connect') {
      const hb = await redis.get('email_worker_heartbeat');
      if (hb) return true;
    }
  } catch (e) {}
  return false;
}

// Default singleton instance
export const emailWorker = new EmailWorker();
export default emailWorker;
