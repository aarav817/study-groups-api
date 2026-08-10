import express, { Response, NextFunction } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest, GroupMessage, GroupConversation, DirectChatRequest, DirectMessage, GroupMembership, User } from '../types';

const router = express.Router();

/**
 * Ensure a default 'General' conversation exists for a group.
 */
async function ensureDefaultConversation(groupId: string, creatorId: string): Promise<string> {
  const existing = await db.query<GroupConversation>(
    'SELECT id FROM group_conversations WHERE group_id = $1 ORDER BY created_at ASC LIMIT 1',
    [groupId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const insert = await db.query<GroupConversation>(
    `INSERT INTO group_conversations (group_id, title, created_by)
     VALUES ($1, 'General', $2)
     ON CONFLICT (group_id, title) DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
    [groupId, creatorId]
  );
  return insert.rows[0].id;
}

/**
 * GET /api/v1/groups/:groupId/conversations
 */
router.get('/groups/:groupId/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const groupId = req.params.groupId as string;

    const membership = await db.query<GroupMembership>(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You must be a member of the group to view conversations.' },
      });
    }

    await ensureDefaultConversation(groupId, req.user!.id);

    const conversationsResult = await db.query<GroupConversation>(
      `SELECT gc.id, gc.group_id, gc.title, gc.created_by, gc.created_at,
              u.full_name AS creator_name,
              COUNT(gm.id)::int AS message_count
       FROM group_conversations gc
       JOIN users u ON gc.created_by = u.id
       LEFT JOIN group_messages gm ON gc.id = gm.conversation_id
       WHERE gc.group_id = $1
       GROUP BY gc.id, u.full_name
       ORDER BY gc.created_at ASC`,
      [groupId]
    );

    return res.status(200).json({
      success: true,
      data: { conversations: conversationsResult.rows },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/groups/:groupId/conversations
 */
router.post('/groups/:groupId/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const groupId = req.params.groupId as string;
    const { title } = req.body || {};

    const membership = await db.query<GroupMembership>(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only group members can create conversation topics.' },
      });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Conversation topic title is required.' },
      });
    }

    const insertResult = await db.query<GroupConversation>(
      `INSERT INTO group_conversations (group_id, title, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, group_id, title, created_by, created_at`,
      [groupId, title.trim(), req.user!.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Conversation topic created successfully.',
      data: { conversation: insertResult.rows[0] },
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { code: 'CONVERSATION_EXISTS', message: 'A conversation topic with that name already exists in this group.' },
      });
    }
    next(err);
  }
});

/**
 * DELETE /api/v1/groups/:groupId/conversations/:conversationId
 * Owner/Admin only: Delete a conversation topic and all its messages.
 */
router.delete('/groups/:groupId/conversations/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const groupId = req.params.groupId as string;
    const conversationId = req.params.conversationId as string;

    const membership = await db.query<GroupMembership>(
      'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0 || !['owner', 'admin'].includes(membership.rows[0].role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only group owners or admins can delete conversation topics.' },
      });
    }

    const convResult = await db.query(
      'SELECT title FROM group_conversations WHERE id = $1 AND group_id = $2',
      [conversationId, groupId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation topic not found.' },
      });
    }

    if (convResult.rows[0].title === 'General') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'The default General conversation topic cannot be deleted.' },
      });
    }

    await db.query('DELETE FROM group_conversations WHERE id = $1 AND group_id = $2', [conversationId, groupId]);

    return res.status(200).json({
      success: true,
      message: 'Conversation topic deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/groups/:groupId/messages
 */
router.get('/groups/:groupId/messages', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const groupId = req.params.groupId as string;
    const conversation_id = typeof req.query.conversation_id === 'string' ? req.query.conversation_id : undefined;

    const membership = await db.query<GroupMembership>(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You must be a member of the group to view messages.' },
      });
    }

    let queryText = `
      SELECT gm.id, gm.group_id, gm.conversation_id, gm.sender_id, gm.content, gm.created_at,
             u.full_name AS sender_name, u.avatar_url AS sender_avatar
      FROM group_messages gm
      JOIN users u ON gm.sender_id = u.id
      WHERE gm.group_id = $1
    `;
    const params: any[] = [groupId];

    if (conversation_id) {
      queryText += ` AND gm.conversation_id = $2`;
      params.push(conversation_id);
    }

    queryText += ` ORDER BY gm.created_at ASC LIMIT 100`;

    const messagesResult = await db.query<GroupMessage>(queryText, params);

    return res.status(200).json({
      success: true,
      data: { messages: messagesResult.rows },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/groups/:groupId/messages
 */
router.post('/groups/:groupId/messages', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const groupId = req.params.groupId as string;
    const { content, conversation_id } = req.body || {};

    const membership = await db.query<GroupMembership>(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only group members can post messages.' },
      });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Message content cannot be empty.' },
      });
    }

    let targetConvId = conversation_id;
    if (!targetConvId) {
      targetConvId = await ensureDefaultConversation(groupId, req.user!.id);
    }

    const insertResult = await db.query<GroupMessage>(
      `INSERT INTO group_messages (group_id, conversation_id, sender_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, group_id, conversation_id, sender_id, content, created_at`,
      [groupId, targetConvId, req.user!.id, content.trim()]
    );

    const message = {
      ...insertResult.rows[0],
      sender_name: req.user!.full_name,
      sender_avatar: req.user!.avatar_url,
    };

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: { message },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/direct-chats/request
 */
router.post('/direct-chats/request', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { messaging_code } = req.body || {};

    if (!messaging_code || typeof messaging_code !== 'string' || !messaging_code.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'User messaging code is required.' },
      });
    }

    const targetUser = await db.query<User>(
      'SELECT id, full_name FROM users WHERE messaging_code = $1',
      [messaging_code.toUpperCase().trim()]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'No user found matching that messaging code.' },
      });
    }

    const receiverId = targetUser.rows[0].id;

    if (receiverId === req.user!.id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'You cannot send a chat request to yourself.' },
      });
    }

    const existingRequest = await db.query<DirectChatRequest>(
      `SELECT id, status FROM direct_chat_requests 
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
      [req.user!.id, receiverId]
    );

    if (existingRequest.rows.length > 0) {
      const reqStatus = existingRequest.rows[0].status;
      if (reqStatus === 'accepted') {
        return res.status(200).json({
          success: true,
          message: 'Direct chat already active.',
          data: { chat_request: existingRequest.rows[0] },
        });
      }
      return res.status(409).json({
        success: false,
        error: { code: 'REQUEST_EXISTS', message: `A chat request is already ${reqStatus}.` },
      });
    }

    const insertResult = await db.query<DirectChatRequest>(
      `INSERT INTO direct_chat_requests (sender_id, receiver_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, sender_id, receiver_id, status, created_at, updated_at`,
      [req.user!.id, receiverId]
    );

    return res.status(201).json({
      success: true,
      message: 'Direct chat request sent!',
      data: { chat_request: insertResult.rows[0] },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/direct-chats
 */
router.get('/direct-chats', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const pendingRequests = await db.query<DirectChatRequest>(
      `SELECT dcr.id, dcr.sender_id, dcr.receiver_id, dcr.status, dcr.created_at,
              u.full_name AS sender_name, u.avatar_url AS sender_avatar, u.messaging_code AS sender_code
       FROM direct_chat_requests dcr
       JOIN users u ON dcr.sender_id = u.id
       WHERE dcr.receiver_id = $1 AND dcr.status = 'pending'
       ORDER BY dcr.created_at DESC`,
      [req.user!.id]
    );

    const activeChats = await db.query(
      `SELECT dcr.id, dcr.status, dcr.created_at,
              CASE WHEN dcr.sender_id = $1 THEN dcr.receiver_id ELSE dcr.sender_id END AS partner_id,
              u.full_name AS partner_name, u.avatar_url AS partner_avatar, u.messaging_code AS partner_code
       FROM direct_chat_requests dcr
       JOIN users u ON (CASE WHEN dcr.sender_id = $1 THEN dcr.receiver_id ELSE dcr.sender_id END) = u.id
       WHERE (dcr.sender_id = $1 OR dcr.receiver_id = $1) AND dcr.status = 'accepted'
       ORDER BY dcr.updated_at DESC`,
      [req.user!.id]
    );

    return res.status(200).json({
      success: true,
      data: {
        pending_requests: pendingRequests.rows,
        active_chats: activeChats.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/direct-chats/request/:requestId
 */
router.patch('/direct-chats/request/:requestId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { requestId } = req.params;
    const { action } = req.body || {};

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Action must be "accept" or "decline".' },
      });
    }

    const reqResult = await db.query<DirectChatRequest>(
      'SELECT id, receiver_id, status FROM direct_chat_requests WHERE id = $1',
      [requestId]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'REQUEST_NOT_FOUND', message: 'Chat request not found.' },
      });
    }

    if (reqResult.rows[0].receiver_id !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the recipient can respond to this request.' },
      });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    const updateResult = await db.query<DirectChatRequest>(
      `UPDATE direct_chat_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [newStatus, requestId]
    );

    return res.status(200).json({
      success: true,
      message: `Chat request ${newStatus}.`,
      data: { chat_request: updateResult.rows[0] },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/direct-messages/:partnerId
 */
router.get('/direct-messages/:partnerId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { partnerId } = req.params;

    const chatPermission = await db.query(
      `SELECT id FROM direct_chat_requests 
       WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
         AND status = 'accepted'`,
      [req.user!.id, partnerId]
    );

    if (chatPermission.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You must have an accepted chat request to view messages.' },
      });
    }

    const messages = await db.query<DirectMessage>(
      `SELECT dm.id, dm.sender_id, dm.receiver_id, dm.content, dm.created_at,
              u.full_name AS sender_name, u.avatar_url AS sender_avatar
       FROM direct_messages dm
       JOIN users u ON dm.sender_id = u.id
       WHERE (dm.sender_id = $1 AND dm.receiver_id = $2) OR (dm.sender_id = $2 AND dm.receiver_id = $1)
       ORDER BY dm.created_at ASC
       LIMIT 100`,
      [req.user!.id, partnerId]
    );

    return res.status(200).json({
      success: true,
      data: { messages: messages.rows },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/direct-messages/:partnerId
 */
router.post('/direct-messages/:partnerId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { partnerId } = req.params;
    const { content } = req.body || {};

    const chatPermission = await db.query(
      `SELECT id FROM direct_chat_requests 
       WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
         AND status = 'accepted'`,
      [req.user!.id, partnerId]
    );

    if (chatPermission.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Must accept chat request before sending messages.' },
      });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Message content cannot be empty.' },
      });
    }

    const insertResult = await db.query<DirectMessage>(
      `INSERT INTO direct_messages (sender_id, receiver_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, receiver_id, content, created_at`,
      [req.user!.id, partnerId, content.trim()]
    );

    const message = {
      ...insertResult.rows[0],
      sender_name: req.user!.full_name,
      sender_avatar: req.user!.avatar_url,
    };

    return res.status(201).json({
      success: true,
      message: 'Direct message sent.',
      data: { message },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
