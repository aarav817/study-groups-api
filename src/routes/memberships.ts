import express, { Response, NextFunction } from 'express';
import crypto from 'crypto';
import db, { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { invalidatePublicGroupsCache } from '../redis';
import { enqueueJoinNotification } from '../queue/emailQueue';
import { AuthenticatedRequest, GroupMembership, GroupInvite } from '../types';

const router = express.Router();

/**
 * GET /api/v1/groups/:groupId/members
 */
router.get('/groups/:groupId/members', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { groupId } = req.params;

    const result = await db.query<GroupMembership>(
      `SELECT gm.id, gm.group_id, gm.user_id, gm.role, gm.joined_at,
              u.full_name, u.email, u.avatar_url, u.bio
       FROM group_memberships gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY 
         CASE gm.role 
           WHEN 'owner' THEN 1 
           WHEN 'admin' THEN 2 
           ELSE 3 
         END, gm.joined_at ASC`,
      [groupId]
    );

    return res.status(200).json({
      success: true,
      data: { members: result.rows },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/groups/:groupId/members
 */
router.post('/groups/:groupId/members', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const client = await pool.connect();
  try {
    const { groupId } = req.params;
    const userId = req.user!.id;

    await client.query('BEGIN');

    // Acquire row-level lock on target study group to serialize concurrent join operations
    const groupResult = await client.query(
      'SELECT id, is_public FROM study_groups WHERE id = $1 FOR UPDATE',
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: 'Study group not found.' },
      });
    }

    // Check if user is already a member
    const existingMembership = await client.query(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (existingMembership.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_MEMBER',
          message: 'You are already a member of this study group.',
        },
      });
    }

    // Enforce 10-member maximum capacity constraint under lock
    const countResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM group_memberships WHERE group_id = $1',
      [groupId]
    );
    const memberCount = countResult.rows[0].count;

    if (memberCount >= 10) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: {
          code: 'GROUP_FULL',
          message: 'This study group has reached its maximum capacity of 10 members.',
        },
      });
    }

    // Insert new membership
    const insertResult = await client.query<GroupMembership>(
      `INSERT INTO group_memberships (group_id, user_id, role)
       VALUES ($1, $2, 'member')
       RETURNING id, group_id, user_id, role, joined_at`,
      [groupId, userId]
    );

    await client.query('COMMIT');

    await invalidatePublicGroupsCache();

    // Asynchronously queue email notification to group owner without blocking response
    notifyOwnerOfJoin(String(groupId), userId, req.user?.full_name);

    return res.status(201).json({
      success: true,
      message: 'Joined study group successfully.',
      data: { membership: insertResult.rows[0] },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/v1/groups/:groupId/members/:userId
 */
router.delete('/groups/:groupId/members/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { groupId, userId } = req.params;

    const isSelf = req.user!.id === userId;

    if (!isSelf) {
      const reqMembership = await db.query<GroupMembership>(
        'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
        [groupId, req.user!.id]
      );
      if (reqMembership.rows.length === 0 || !['owner', 'admin'].includes(reqMembership.rows[0].role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only group owners or admins can remove members.' },
        });
      }
    }

    const deleteResult = await db.query(
      'DELETE FROM group_memberships WHERE group_id = $1 AND user_id = $2 RETURNING id',
      [groupId, userId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEMBERSHIP_NOT_FOUND', message: 'User is not a member of this study group.' },
      });
    }

    await invalidatePublicGroupsCache();

    return res.status(200).json({
      success: true,
      message: isSelf ? 'Left study group successfully.' : 'Member removed from group.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/groups/:groupId/members/:userId/role
 * Owner-only: promote a member to admin, or demote an admin to member.
 */
router.patch('/groups/:groupId/members/:userId/role', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body || {};

    if (!role || !['admin', 'member'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Role must be "admin" or "member".' },
      });
    }

    // Only the group owner can change roles
    const callerMembership = await db.query<GroupMembership>(
      'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (callerMembership.rows.length === 0 || callerMembership.rows[0].role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the group owner can change member roles.' },
      });
    }

    // Cannot change own role
    if (userId === req.user!.id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'You cannot change your own role.' },
      });
    }

    const targetMembership = await db.query<GroupMembership>(
      'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (targetMembership.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEMBERSHIP_NOT_FOUND', message: 'User is not a member of this group.' },
      });
    }

    if (targetMembership.rows[0].role === 'owner') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'Cannot change the role of the group owner.' },
      });
    }

    const updateResult = await db.query<GroupMembership>(
      `UPDATE group_memberships SET role = $1 WHERE group_id = $2 AND user_id = $3
       RETURNING id, group_id, user_id, role, joined_at`,
      [role, groupId, userId]
    );

    return res.status(200).json({
      success: true,
      message: `Member role updated to ${role}.`,
      data: { membership: updateResult.rows[0] },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/groups/:groupId/invites
 */
router.post('/groups/:groupId/invites', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { groupId } = req.params;

    const membership = await db.query<GroupMembership>(
      'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You must be a member of the group to generate invite links.' },
      });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await db.query<GroupInvite>(
      `INSERT INTO group_invites (group_id, token, created_by, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, group_id, token, created_by, expires_at, created_at`,
      [groupId, token, req.user!.id, expiresAt]
    );

    const invite = result.rows[0];
    const inviteUrl = `${req.protocol}://${req.get('host')}/api/v1/invites/${token}`;

    return res.status(201).json({
      success: true,
      message: 'Invite link generated successfully.',
      data: {
        invite: {
          ...invite,
          invite_url: inviteUrl,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/invites/:token/join
 */
router.post('/invites/:token/join', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const client = await pool.connect();
  try {
    const { token } = req.params;
    const userId = req.user!.id;

    await client.query('BEGIN');

    const inviteResult = await client.query<GroupInvite>(
      'SELECT id, group_id, expires_at FROM group_invites WHERE token = $1',
      [token]
    );

    if (inviteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: { code: 'INVITE_NOT_FOUND', message: 'Invite token is invalid.' },
      });
    }

    const invite = inviteResult.rows[0];

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({
        success: false,
        error: { code: 'INVITE_EXPIRED', message: 'This invite link has expired.' },
      });
    }

    // Acquire row lock on target study group
    await client.query('SELECT id FROM study_groups WHERE id = $1 FOR UPDATE', [invite.group_id]);

    const existingMembership = await client.query(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [invite.group_id, userId]
    );

    if (existingMembership.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(200).json({
        success: true,
        message: 'You are already a member of this study group.',
        data: { group_id: invite.group_id },
      });
    }

    // Enforce 10-member limit under lock
    const countResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM group_memberships WHERE group_id = $1',
      [invite.group_id]
    );
    const memberCount = countResult.rows[0].count;

    if (memberCount >= 10) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: {
          code: 'GROUP_FULL',
          message: 'This study group has reached its maximum capacity of 10 members.',
        },
      });
    }

    const insertResult = await client.query<GroupMembership>(
      `INSERT INTO group_memberships (group_id, user_id, role)
       VALUES ($1, $2, 'member')
       RETURNING id, group_id, user_id, role, joined_at`,
      [invite.group_id, userId]
    );

    await client.query('COMMIT');

    await invalidatePublicGroupsCache();

    // Asynchronously queue email notification to group owner without blocking response
    notifyOwnerOfJoin(invite.group_id, userId, req.user?.full_name);

    return res.status(201).json({
      success: true,
      message: 'Joined study group via invite link!',
      data: { membership: insertResult.rows[0] },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

async function notifyOwnerOfJoin(groupId: string, joinedUserId: string, fallbackJoinedName?: string) {
  try {
    const res = await db.query(
      `SELECT sg.title AS group_title, sg.created_by AS owner_id,
              u_owner.email AS owner_email, u_owner.full_name AS owner_name,
              u_join.full_name AS joined_user_name
       FROM study_groups sg
       JOIN users u_owner ON sg.created_by = u_owner.id
       LEFT JOIN users u_join ON u_join.id = $2
       WHERE sg.id = $1`,
      [groupId, joinedUserId]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      if (row.owner_id !== joinedUserId) {
        await enqueueJoinNotification({
          groupId,
          groupTitle: row.group_title,
          ownerUserId: row.owner_id,
          ownerEmail: row.owner_email,
          ownerName: row.owner_name,
          joinedUserId,
          joinedUserName: row.joined_user_name || fallbackJoinedName || 'A new member',
        });
      }
    }
  } catch (err) {
    console.error('[Memberships] Failed to queue join notification:', err);
  }
}

export default router;
