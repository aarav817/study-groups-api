import http from 'http';
import db from '../db';
import { enqueueJoinNotification } from '../queue/emailQueue';

class TrafficGenerator {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private targetPort: number = parseInt(process.env.PORT || '3000', 10);

  public start(intervalMs = 10): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[TrafficGenerator] Started load traffic simulation (request batch every ${intervalMs}ms).`);
    this.loop(intervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[TrafficGenerator] Stopped load traffic simulation.');
  }

  public getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }

  private loop(intervalMs: number): void {
    if (!this.isRunning) return;
    this.timer = setTimeout(async () => {
      await this.generateBatch();
      this.loop(intervalMs);
    }, intervalMs);
  }

  private sendRequest(path: string, method = 'GET', headers: Record<string, string> = {}): Promise<number> {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.targetPort,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        },
        (res) => {
          res.on('data', () => { });
          res.on('end', () => resolve(res.statusCode || 500));
        }
      );
      req.on('error', () => resolve(500));
      req.end();
    });
  }

  private async generateBatch(): Promise<void> {
    try {
      const rand = Math.random();

      if (rand < 0.8) {
        // 2xx HTTP Success & Normal DB queries
        await this.sendRequest('/health');
        await db.query('SELECT COUNT(*)::int AS count FROM study_groups');
      } else if (rand < 0.9) {
        // 4xx Client Errors (Validation/Not Found/Unauthorized)
        if (Math.random() < 0.5) {
          await this.sendRequest('/api/v1/invalid-route-path'); // 404 Not Found
        } else {
          await this.sendRequest('/api/v1/groups/00000000-0000-0000-0000-000000000000/events'); // 401 Unauthorized
        }
      } else if (rand < 0.95) {
        // Enqueue Email Notification Jobs
        await enqueueJoinNotification({
          groupId: '00000000-0000-0000-0000-000000000000',
          groupTitle: 'Simulated Load Group',
          ownerUserId: '00000000-0000-0000-0000-000000000000',
          ownerEmail: 'loadtest@stanford.edu',
          ownerName: 'Load Tester',
          joinedUserId: '00000000-0000-0000-0000-000000000001',
          joinedUserName: 'Simulated User',
        });
      } else {
        // DB Query Latency simulation
        await db.query('SELECT pg_sleep(0.05)');
      }
    } catch (e) {
      // Ignore simulation background errors
    }
  }
}

export const trafficGenerator = new TrafficGenerator();
export default trafficGenerator;
