import express, { Response, NextFunction } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest, Material, MaterialFolder, GroupMembership } from '../types';
import { getCache, setCache, invalidateMaterialsCache } from '../redis';

const router = express.Router();

/**
 * GET /api/v1/groups/:groupId/materials
 */
router.get('/groups/:groupId/materials', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const groupId = req.params.groupId as string;
    const folder_id = typeof req.query.folder_id === 'string' ? req.query.folder_id : undefined;

    const membership = await db.query<GroupMembership>(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You must be a member of the group to access study materials.' },
      });
    }

    // Check Redis / In-Memory Cache
    const cacheKey = `materials:group:${groupId}:${folder_id || 'all'}`;
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.status(200).json(cached.data);
    }

    const foldersResult = await db.query<MaterialFolder>(
      'SELECT id, group_id, name, created_by, created_at FROM material_folders WHERE group_id = $1 ORDER BY name ASC',
      [groupId]
    );

    let materialsQuery = `
      SELECT m.id, m.group_id, m.folder_id, m.uploaded_by, m.title, m.file_format, m.file_size_bytes, m.file_url, m.created_at,
             u.full_name AS uploader_name, u.avatar_url AS uploader_avatar
      FROM materials m
      JOIN users u ON m.uploaded_by = u.id
      WHERE m.group_id = $1
    `;
    const queryParams: any[] = [groupId];

    if (folder_id) {
      materialsQuery += ` AND m.folder_id = $2`;
      queryParams.push(folder_id);
    }

    materialsQuery += ` ORDER BY m.created_at DESC`;

    const materialsResult = await db.query<Material>(materialsQuery, queryParams);

    const responsePayload = {
      success: true,
      data: {
        folders: foldersResult.rows,
        materials: materialsResult.rows,
      },
    };

    // Store in cache (60s TTL)
    await setCache(cacheKey, responsePayload, 60);

    return res.status(200).json(responsePayload);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/groups/:groupId/material-folders
 */
router.post('/groups/:groupId/material-folders', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const groupId = req.params.groupId as string;
    const { name } = req.body || {};

    const membership = await db.query<GroupMembership>(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only group members can create folders.' },
      });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Folder name is required.' },
      });
    }

    const insertResult = await db.query<MaterialFolder>(
      `INSERT INTO material_folders (group_id, name, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, group_id, name, created_by, created_at`,
      [groupId, name.trim(), req.user!.id]
    );

    // Invalidate materials cache for group
    await invalidateMaterialsCache(groupId);

    return res.status(201).json({
      success: true,
      message: 'Folder created successfully.',
      data: { folder: insertResult.rows[0] },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/groups/:groupId/materials
 */
router.post('/groups/:groupId/materials', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const groupId = req.params.groupId as string;
    const { title, file_format, file_size_bytes, file_url, folder_id } = req.body || {};

    const membership = await db.query<GroupMembership>(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only group members can upload materials.' },
      });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Material title is required.' },
      });
    }

    if (!file_url || typeof file_url !== 'string' || !file_url.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'file_url is required.' },
      });
    }

    const insertResult = await db.query<Material>(
      `INSERT INTO materials (group_id, folder_id, uploaded_by, title, file_format, file_size_bytes, file_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, group_id, folder_id, uploaded_by, title, file_format, file_size_bytes, file_url, created_at`,
      [
        groupId,
        folder_id || null,
        req.user!.id,
        title.trim(),
        file_format ? file_format.toLowerCase().trim() : 'pdf',
        file_size_bytes || 0,
        file_url.trim(),
      ]
    );

    const material = insertResult.rows[0];

    // Invalidate materials cache for group
    await invalidateMaterialsCache(groupId);

    return res.status(201).json({
      success: true,
      message: 'Study material uploaded successfully.',
      data: { material },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/materials/all
 */
router.get('/materials/all', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const cacheKey = `materials:user:${req.user!.id}`;
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.status(200).json(cached.data);
    }

    const materialsResult = await db.query<Material>(
      `SELECT m.id, m.group_id, m.folder_id, m.uploaded_by, m.title, m.file_format, m.file_size_bytes, m.file_url, m.created_at,
              sg.title AS group_title, u.full_name AS uploader_name, mf.name AS folder_name
       FROM materials m
       JOIN study_groups sg ON m.group_id = sg.id
       JOIN users u ON m.uploaded_by = u.id
       LEFT JOIN material_folders mf ON m.folder_id = mf.id
       WHERE m.group_id IN (SELECT group_id FROM group_memberships WHERE user_id = $1)
       ORDER BY m.created_at DESC`,
      [req.user!.id]
    );

    const foldersResult = await db.query<MaterialFolder>(
      `SELECT mf.id, mf.group_id, mf.name, mf.created_at, sg.title AS group_title
       FROM material_folders mf
       JOIN study_groups sg ON mf.group_id = sg.id
       WHERE mf.group_id IN (SELECT group_id FROM group_memberships WHERE user_id = $1)
       ORDER BY mf.name ASC`,
      [req.user!.id]
    );

    const responsePayload = {
      success: true,
      data: {
        materials: materialsResult.rows,
        folders: foldersResult.rows,
      },
    };

    // Store in cache (60s TTL)
    await setCache(cacheKey, responsePayload, 60);

    return res.status(200).json(responsePayload);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/groups/:groupId/materials/:materialId
 * Owner/Admin only: delete a specific material from the group.
 */
router.delete('/groups/:groupId/materials/:materialId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const groupId = req.params.groupId as string;
    const materialId = req.params.materialId as string;

    // Verify caller is owner or admin
    const membership = await db.query<GroupMembership>(
      'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0 || !['owner', 'admin'].includes(membership.rows[0].role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only group owners or admins can delete materials.' },
      });
    }

    const deleteResult = await db.query(
      'DELETE FROM materials WHERE id = $1 AND group_id = $2 RETURNING id',
      [materialId, groupId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'MATERIAL_NOT_FOUND', message: 'Material not found in this group.' },
      });
    }

    await invalidateMaterialsCache(groupId);

    return res.status(200).json({
      success: true,
      message: 'Material deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
