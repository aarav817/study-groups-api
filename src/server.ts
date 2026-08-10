import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import groupsRouter from './routes/groups';
import membershipsRouter from './routes/memberships';
import eventsRouter from './routes/events';
import materialsRouter from './routes/materials';
import messagesRouter from './routes/messages';
import reportsRouter from './routes/reports';
import adminRouter from './routes/admin';
import emailWorker from './worker/emailWorker';
import metricsCollector from './utils/metrics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3005',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3005',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all for dev
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(metricsCollector.expressMiddleware);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} (${duration}ms) -> Status ${res.statusCode}`);
  });
  next();
});

// Mount API routes
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/groups', groupsRouter);
app.use('/api/v1', membershipsRouter);
app.use('/api/v1', eventsRouter);
app.use('/api/v1', materialsRouter);
app.use('/api/v1', messagesRouter);
app.use('/api/v1/reports', reportsRouter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'study-groups-api',
  });
});

// Global 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found.`,
    },
  });
});

// Global error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected internal server error occurred.',
    },
  });
});

// Start server if executed directly
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  const PORT_NUM = parseInt(process.env.PORT || '3000', 10);
  const server = app.listen(PORT_NUM, '0.0.0.0', () => {
    console.log(`Study Groups API Server listening on 0.0.0.0:${PORT_NUM}`);
    if (process.env.ENABLE_IN_PROCESS_WORKER === 'true') {
      console.log('[Server] Starting in-process email worker...');
      emailWorker.start();
    } else {
      console.log('[Server] Asynchronous email worker is decoupled (Run standalone process via: npm run worker)');
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Error] Port ${PORT} is already in use. Please stop any process running on port ${PORT} or change PORT in .env.`);
    } else {
      console.error('Server error:', err);
    }
  });
}

export default app;
