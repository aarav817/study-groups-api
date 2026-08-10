import express, { Response, NextFunction } from 'express';
import db from '../db';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { getCache, setCache, invalidatePublicGroupsCache } from '../redis';
import { AuthenticatedRequest, StudyGroup, GroupMembership } from '../types';

const router = express.Router();

/**
 * GET /api/v1/groups
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const searchQuery = req.query.q ? `%${(req.query.q as string).trim()}%` : null;
    const isPublicFilter = req.query.public === 'true';

    if (isPublicFilter) {
      const cacheKey = `public_groups:${req.query.q ? (req.query.q as string).trim().toLowerCase() : 'all'}`;
      const cached = await getCache<StudyGroup[]>(cacheKey);

      if (cached && cached.data) {
        res.setHeader('X-Cache', `HIT (${cached.source})`);

        const userId = req.user ? req.user.id : null;
        let groups = cached.data;

        if (userId) {
          const memberships = await db.query<GroupMembership>(
            `SELECT group_id FROM group_memberships WHERE user_id = $1`,
            [userId]
          );
          const memberGroupIds = new Set(memberships.rows.map((m) => m.group_id));
          groups = groups.map((g) => ({
            ...g,
            is_member: memberGroupIds.has(g.id),
          }));
        } else {
          groups = groups.map((g) => ({ ...g, is_member: false }));
        }

        return res.status(200).json({
          success: true,
          cached: true,
          cache_source: cached.source,
          data: { groups },
        });
      }

      // CACHE MISS
      const userId = req.user ? req.user.id : null;
      const queryText = `
        SELECT sg.id, sg.title, sg.description, sg.is_public, sg.created_by, sg.created_at, sg.updated_at,
               u.full_name AS creator_name,
               (SELECT COUNT(*)::int FROM group_memberships WHERE group_id = sg.id) AS member_count,
               (SELECT COUNT(*)::int > 0 FROM group_memberships WHERE group_id = sg.id AND user_id = $1) AS is_member
        FROM study_groups sg
        JOIN users u ON sg.created_by = u.id
        WHERE (sg.is_public IS NOT FALSE OR sg.is_public IS NULL)
        ${searchQuery ? ` AND (sg.title ILIKE $2 OR sg.description ILIKE $2)` : ''}
        ORDER BY member_count DESC, sg.created_at DESC LIMIT 50
      `;
      const params = searchQuery ? [userId, searchQuery] : [userId];

      const result = await db.query<StudyGroup>(queryText, params);

      // Store in Redis cache for 60 seconds
      await setCache(cacheKey, result.rows, 60);

      return res.status(200).json({
        success: true,
        cached: false,
        data: { groups: result.rows },
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please log in.',
        },
      });
    }

    const queryText = `
      SELECT sg.id, sg.title, sg.description, sg.is_public, sg.created_by, sg.created_at, sg.updated_at,
             u.full_name AS creator_name,
             (SELECT COUNT(*)::int FROM group_memberships WHERE group_id = sg.id) AS member_count,
             TRUE AS is_member
      FROM study_groups sg
      JOIN users u ON sg.created_by = u.id
      WHERE sg.id IN (SELECT group_id FROM group_memberships WHERE user_id = $1)
      ${searchQuery ? ` AND (sg.title ILIKE $2 OR sg.description ILIKE $2)` : ''}
      ORDER BY sg.created_at DESC
    `;
    const params = searchQuery ? [req.user.id, searchQuery] : [req.user.id];

    const result = await db.query<StudyGroup>(queryText, params);
    return res.status(200).json({
      success: true,
      data: { groups: result.rows },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/groups
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { title, description, is_public = true } = req.body || {};
    const isPublicVal = is_public === false || is_public === 'false' ? false : true;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title is required.',
          details: [{ field: 'title', issue: 'Title cannot be empty.' }],
        },
      });
    }

    if (title.trim().length > 150) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title cannot exceed 150 characters.',
        },
      });
    }

    const groupResult = await db.query<StudyGroup>(
      `INSERT INTO study_groups (title, description, is_public, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, description, is_public, created_by, created_at, updated_at`,
      [title.trim(), description ? description.trim() : null, isPublicVal, req.user!.id]
    );
    const group = groupResult.rows[0];

    await db.query(
      `INSERT INTO group_memberships (group_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [group.id, req.user!.id]
    );

    await invalidatePublicGroupsCache();

    return res.status(201).json({
      success: true,
      message: 'Study group created successfully.',
      data: { group },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/groups/:groupId
 */
router.get('/:groupId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { groupId } = req.params;

    const groupResult = await db.query<StudyGroup>(
      `SELECT sg.id, sg.title, sg.description, sg.is_public, sg.created_by, sg.created_at, sg.updated_at,
              u.full_name AS creator_name, u.email AS creator_email,
              COUNT(gm.id)::int AS member_count
       FROM study_groups sg
       JOIN users u ON sg.created_by = u.id
       LEFT JOIN group_memberships gm ON sg.id = gm.group_id
       WHERE sg.id = $1
       GROUP BY sg.id, u.full_name, u.email`,
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'GROUP_NOT_FOUND',
          message: 'Study group not found.',
        },
      });
    }

    const group = groupResult.rows[0];

    const membershipResult = await db.query<GroupMembership>(
      `SELECT role, joined_at FROM group_memberships WHERE group_id = $1 AND user_id = $2`,
      [groupId, req.user!.id]
    );

    group.user_membership = membershipResult.rows[0] || null;

    return res.status(200).json({
      success: true,
      data: { group },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/groups/:groupId
 */
router.patch('/:groupId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { groupId } = req.params;
    const { title, description, is_public } = req.body || {};

    const membership = await db.query<GroupMembership>(
      `SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2`,
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0 || !['owner', 'admin'].includes(membership.rows[0].role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only group owners or admins can update group details.',
        },
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Title cannot be empty.' },
        });
      }
      updates.push(`title = $${paramIdx++}`);
      values.push(title.trim());
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(description ? description.trim() : null);
    }

    if (is_public !== undefined) {
      const isPublicVal = is_public === false || is_public === 'false' ? false : true;
      updates.push(`is_public = $${paramIdx++}`);
      values.push(isPublicVal);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_UPDATES_PROVIDED', message: 'Provide title or description to update.' },
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(groupId);

    const result = await db.query<StudyGroup>(
      `UPDATE study_groups SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    await invalidatePublicGroupsCache();

    return res.status(200).json({
      success: true,
      message: 'Study group updated successfully.',
      data: { group: result.rows[0] },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/groups/:groupId
 */
router.delete('/:groupId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { groupId } = req.params;

    const groupResult = await db.query<StudyGroup>(
      'SELECT created_by FROM study_groups WHERE id = $1',
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: 'Study group not found.' },
      });
    }

    if (groupResult.rows[0].created_by !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the group creator can delete this study group.' },
      });
    }

    await db.query('DELETE FROM study_groups WHERE id = $1', [groupId]);

    await invalidatePublicGroupsCache();

    return res.status(200).json({
      success: true,
      message: 'Study group deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
