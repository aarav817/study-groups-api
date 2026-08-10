import { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { getQueueLength, getFailedQueueLength } from '../queue/emailQueue';
import emailWorker, { isWorkerAlive } from '../worker/emailWorker';

export interface HttpMetrics {
  total: number;
  status_2xx: number;
  status_3xx: number;
  status_4xx: number;
  status_5xx: number;
  client_error_rate_pct: number;
  server_error_rate_pct: number;
  by_status_code: Record<string, number>;
}

export interface DbMetrics {
  total_queries: number;
  slow_queries_count: number; // queries > 100ms
  total_query_time_ms: number;
  avg_query_time_ms: number;
  max_query_time_ms: number;
  pool_total_connections: number;
  pool_idle_connections: number;
  pool_waiting_clients: number;
}

export interface WorkerMetrics {
  is_running: boolean;
  poll_interval_ms: number;
  max_retries: number;
  last_poll_timestamp: string | null;
  total_jobs_processed: number;
  total_jobs_failed: number;
  consecutive_failures: number;
  pending_queue_length: number;
  dead_letter_queue_length: number;
}

class MetricsCollector {
  private windowStartTime: string = new Date().toISOString();
  private windowResetIntervalSec: number = 60;
  private resetTimer: NodeJS.Timeout | null = null;

  private httpStats = {
    total: 0,
    status_2xx: 0,
    status_3xx: 0,
    status_4xx: 0,
    status_5xx: 0,
    by_status_code: {} as Record<string, number>,
  };

  private dbStats = {
    totalQueries: 0,
    slowQueriesCount: 0,
    totalQueryTimeMs: 0,
    maxQueryTimeMs: 0,
  };

  private workerStats = {
    lastPollTimestamp: null as string | null,
    totalJobsProcessed: 0,
    totalJobsFailed: 0,
    consecutiveFailures: 0,
  };

  constructor() {
    this.startRollingWindowTimer();
  }

  /**
   * Start 60-second rolling metrics window reset timer.
   */
  private startRollingWindowTimer(): void {
    if (this.resetTimer) return;
    this.resetTimer = setInterval(() => {
      this.resetRollingWindow();
    }, 60000); // 60 seconds
  }

  /**
   * Reset metric counters for the new 1-minute window.
   */
  public resetRollingWindow(): void {
    this.windowStartTime = new Date().toISOString();

    this.httpStats = {
      total: 0,
      status_2xx: 0,
      status_3xx: 0,
      status_4xx: 0,
      status_5xx: 0,
      by_status_code: {},
    };

    this.dbStats = {
      totalQueries: 0,
      slowQueriesCount: 0,
      totalQueryTimeMs: 0,
      maxQueryTimeMs: 0,
    };

    this.workerStats.totalJobsProcessed = 0;
    this.workerStats.totalJobsFailed = 0;
    this.workerStats.consecutiveFailures = 0;
  }

  // Track HTTP middleware
  public expressMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      const statusCode = res.statusCode;
      const codeStr = statusCode.toString();

      this.httpStats.total += 1;
      this.httpStats.by_status_code[codeStr] = (this.httpStats.by_status_code[codeStr] || 0) + 1;

      if (statusCode >= 200 && statusCode < 300) {
        this.httpStats.status_2xx += 1;
      } else if (statusCode >= 300 && statusCode < 400) {
        this.httpStats.status_3xx += 1;
      } else if (statusCode >= 400 && statusCode < 500) {
        this.httpStats.status_4xx += 1;
      } else if (statusCode >= 500) {
        this.httpStats.status_5xx += 1;
      }
    });

    next();
  };

  // DB Query latency tracker
  public recordDbQuery(durationMs: number): void {
    this.dbStats.totalQueries += 1;
    this.dbStats.totalQueryTimeMs += durationMs;
    if (durationMs > this.dbStats.maxQueryTimeMs) {
      this.dbStats.maxQueryTimeMs = Math.round(durationMs * 100) / 100;
    }
    if (durationMs >= 100) {
      this.dbStats.slowQueriesCount += 1;
    }
  }

  // Worker events
  public recordWorkerPoll(): void {
    this.workerStats.lastPollTimestamp = new Date().toISOString();
  }

  public recordWorkerJobSuccess(): void {
    this.workerStats.totalJobsProcessed += 1;
    this.workerStats.consecutiveFailures = 0;
  }

  public recordWorkerJobFailure(): void {
    this.workerStats.totalJobsFailed += 1;
    this.workerStats.consecutiveFailures += 1;
  }

  // Snapshot telemetry payload
  public async getMetricsSnapshot(): Promise<{
    timestamp: string;
    window_start_time: string;
    window_reset_interval_sec: number;
    http: HttpMetrics;
    database: DbMetrics;
    worker: WorkerMetrics;
    system_status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    alarms: {
      high_5xx_server_errors: boolean;
      database_slow: boolean;
      worker_failing: boolean;
      dead_letter_queue_spike: boolean;
    };
  }> {
    const totalHttp = this.httpStats.total || 1;
    const clientErrorRate = Math.round((this.httpStats.status_4xx / totalHttp) * 10000) / 100;
    const serverErrorRate = Math.round((this.httpStats.status_5xx / totalHttp) * 10000) / 100;

    const avgQueryTimeMs = this.dbStats.totalQueries > 0
      ? Math.round((this.dbStats.totalQueryTimeMs / this.dbStats.totalQueries) * 100) / 100
      : 0;

    const pendingQueueLength = await getQueueLength();
    const deadLetterQueueLength = await getFailedQueueLength();
    const workerStatus = emailWorker.getStatus();

    // Alarm conditions
    const high5xx = serverErrorRate > 5.0;
    const dbSlow = avgQueryTimeMs > 100 || this.dbStats.slowQueriesCount > 5;
    const activeWorker = await isWorkerAlive();
    const workerFailing = (!activeWorker && pendingQueueLength > 0) || this.workerStats.consecutiveFailures >= 3;
    const dlqSpike = deadLetterQueueLength > 0;

    let systemStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    if (high5xx || workerFailing || dlqSpike) {
      systemStatus = 'CRITICAL';
    } else if (dbSlow || clientErrorRate > 25.0) {
      systemStatus = 'DEGRADED';
    }

    return {
      timestamp: new Date().toISOString(),
      window_start_time: this.windowStartTime,
      window_reset_interval_sec: this.windowResetIntervalSec,
      http: {
        total: this.httpStats.total,
        status_2xx: this.httpStats.status_2xx,
        status_3xx: this.httpStats.status_3xx,
        status_4xx: this.httpStats.status_4xx,
        status_5xx: this.httpStats.status_5xx,
        client_error_rate_pct: clientErrorRate,
        server_error_rate_pct: serverErrorRate,
        by_status_code: this.httpStats.by_status_code,
      },
      database: {
        total_queries: this.dbStats.totalQueries,
        slow_queries_count: this.dbStats.slowQueriesCount,
        total_query_time_ms: Math.round(this.dbStats.totalQueryTimeMs * 100) / 100,
        avg_query_time_ms: avgQueryTimeMs,
        max_query_time_ms: this.dbStats.maxQueryTimeMs,
        pool_total_connections: pool.pool.totalCount,
        pool_idle_connections: pool.pool.idleCount,
        pool_waiting_clients: pool.pool.waitingCount,
      },
      worker: {
        is_running: workerStatus.isRunning,
        poll_interval_ms: workerStatus.pollIntervalMs,
        max_retries: workerStatus.maxRetries,
        last_poll_timestamp: this.workerStats.lastPollTimestamp,
        total_jobs_processed: this.workerStats.totalJobsProcessed,
        total_jobs_failed: this.workerStats.totalJobsFailed,
        consecutive_failures: this.workerStats.consecutiveFailures,
        pending_queue_length: pendingQueueLength,
        dead_letter_queue_length: deadLetterQueueLength,
      },
      system_status: systemStatus,
      alarms: {
        high_5xx_server_errors: high5xx,
        database_slow: dbSlow,
        worker_failing: workerFailing,
        dead_letter_queue_spike: dlqSpike,
      },
    };
  }
}

export const metricsCollector = new MetricsCollector();
export default metricsCollector;
