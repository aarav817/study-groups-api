import express, { Response } from 'express';
import metricsCollector from '../utils/metrics';
import { requireAdmin } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

import trafficGenerator from '../utils/trafficGenerator';

/**
 * GET /api/v1/admin/metrics
 * Protected operational telemetry JSON metrics endpoint (Admin/Owner access required).
 */
router.get('/metrics', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const snapshot = await metricsCollector.getMetricsSnapshot();
    const simStatus = trafficGenerator.getStatus();
    return res.status(200).json({
      success: true,
      service: 'study-groups-api',
      simulation: simStatus,
      data: snapshot,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'METRICS_ERROR', message: err.message },
    });
  }
});

/**
 * POST /api/v1/admin/simulation/start
 * Start background traffic load simulation.
 */
router.post('/simulation/start', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  trafficGenerator.start();
  return res.status(200).json({
    success: true,
    message: 'Traffic simulation under load started.',
    simulation: trafficGenerator.getStatus(),
  });
});

/**
 * POST /api/v1/admin/simulation/stop
 * Stop background traffic load simulation.
 */
router.post('/simulation/stop', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  trafficGenerator.stop();
  return res.status(200).json({
    success: true,
    message: 'Traffic simulation stopped.',
    simulation: trafficGenerator.getStatus(),
  });
});

/**
 * POST /api/v1/admin/metrics/reset
 * Reset rolling metrics window immediately.
 */
router.post('/metrics/reset', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  metricsCollector.resetRollingWindow();
  const snapshot = await metricsCollector.getMetricsSnapshot();
  return res.status(200).json({
    success: true,
    message: 'Rolling metrics window reset.',
    data: snapshot,
  });
});

export default router;
