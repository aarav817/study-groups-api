import dotenv from 'dotenv';
import { EmailWorker } from './worker/emailWorker';

dotenv.config();

const worker = new EmailWorker();

console.log('[WorkerProcess] Starting standalone Email Worker process...');
worker.start();

const shutdown = () => {
  console.log('[WorkerProcess] Shutting down worker process...');
  worker.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
