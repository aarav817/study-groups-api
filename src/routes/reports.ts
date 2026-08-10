import express, { Response, NextFunction } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

/**
 * POST /api/v1/reports
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { target_type, target_id, reason, details } = req.body || {};

    if (!target_type || !['user', 'group', 'message', 'material', 'event'].includes(target_type)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid target_type (user, group, message, material, event) is required.' },
      });
    }

    if (!target_id || typeof target_id !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'target_id is required.' },
      });
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Report reason is required.' },
      });
    }

    const insertResult = await db.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, reporter_id, target_type, target_id, reason, details, status, created_at`,
      [
        req.user!.id,
        target_type,
        target_id,
        reason.trim(),
        details ? details.trim() : null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Thank you for keeping our community safe.',
      data: { report: insertResult.rows[0] },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
