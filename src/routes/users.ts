import express, { Response, NextFunction } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest, User } from '../types';

const router = express.Router();

/**
 * GET /api/v1/users/me
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  return res.status(200).json({
    success: true,
    data: { user: req.user },
  });
});

/**
 * PATCH /api/v1/users/me
 */
router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { full_name, bio, avatar_url } = req.body || {};

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (full_name !== undefined) {
      if (typeof full_name !== 'string' || !full_name.trim()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Full name cannot be empty.',
          },
        });
      }
      updates.push(`full_name = $${paramIdx++}`);
      values.push(full_name.trim());
    }

    if (bio !== undefined) {
      updates.push(`bio = $${paramIdx++}`);
      values.push(bio ? bio.trim() : null);
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIdx++}`);
      values.push(avatar_url ? avatar_url.trim() : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATES_PROVIDED',
          message: 'Provide at least one field (full_name, bio, avatar_url) to update.',
        },
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.user!.id);

    const result = await db.query<User>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING id, email, full_name, avatar_url, bio, messaging_code, created_at, updated_at`,
      values
    );

    return res.status(200).json({
      success: true,
      message: 'User profile updated successfully.',
      data: { user: result.rows[0] },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/users/:userId
 */
router.get('/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { userId } = req.params;

    const userResult = await db.query<User>(
      `SELECT id, email, full_name, avatar_url, bio, messaging_code, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found.',
        },
      });
    }

    const groupsResult = await db.query(
      `SELECT sg.id, sg.title, sg.description, gm.role, gm.joined_at
       FROM group_memberships gm
       JOIN study_groups sg ON gm.group_id = sg.id
       WHERE gm.user_id = $1
       ORDER BY gm.joined_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        user: {
          ...userResult.rows[0],
          joined_groups: groupsResult.rows,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
