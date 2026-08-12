import http from 'http';
import dotenv from 'dotenv';
import { EmailWorker } from './worker/emailWorker';

dotenv.config();

const worker = new EmailWorker();

console.log('[WorkerProcess] Starting standalone Email Worker process...');
worker.start();

// Health check HTTP server so cloud platforms (like Railway) keep the container Online 24/7
const port = parseInt(process.env.PORT || '3001', 10);
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'healthy', worker: 'active', timestamp: new Date().toISOString() }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[WorkerProcess] Standalone worker health server listening on 0.0.0.0:${port}`);
});

const shutdown = () => {
  console.log('[WorkerProcess] Shutting down worker process...');
  worker.stop();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
