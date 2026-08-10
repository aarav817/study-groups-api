import express, { Response, NextFunction } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest, Event, EventAttendee, GroupMembership } from '../types';

const router = express.Router();

/**
 * GET /api/v1/groups/:groupId/events
 */
router.get('/groups/:groupId/events', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { groupId } = req.params;

    const membership = await db.query<GroupMembership>(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You must be a member of the group to view events.' },
      });
    }

    const eventsResult = await db.query<Event>(
      `SELECT e.id, e.group_id, e.created_by, e.title, e.description, e.location, e.start_time, e.end_time, e.created_at,
              u.full_name AS creator_name,
              COUNT(ea.id)::int AS attendee_count,
              (SELECT COUNT(*)::int > 0 FROM event_attendees WHERE event_id = e.id AND user_id = $2) AS is_attending
       FROM events e
       JOIN users u ON e.created_by = u.id
       LEFT JOIN event_attendees ea ON e.id = ea.event_id
       WHERE e.group_id = $1
       GROUP BY e.id, u.full_name
       ORDER BY e.start_time ASC`,
      [groupId, req.user!.id]
    );

    return res.status(200).json({
      success: true,
      data: { events: eventsResult.rows },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/groups/:groupId/events
 */
router.post('/groups/:groupId/events', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { groupId } = req.params;
    const { title, description, location, start_time, end_time } = req.body || {};

    const membership = await db.query<GroupMembership>(
      'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only group members can schedule events.' },
      });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Event title is required.' },
      });
    }

    if (!start_time || isNaN(Date.parse(start_time))) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid start_time ISO timestamp is required.' },
      });
    }

    const insertResult = await db.query<Event>(
      `INSERT INTO events (group_id, created_by, title, description, location, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, group_id, created_by, title, description, location, start_time, end_time, created_at`,
      [
        groupId,
        req.user!.id,
        title.trim(),
        description ? description.trim() : null,
        location ? location.trim() : null,
        new Date(start_time),
        end_time ? new Date(end_time) : null,
      ]
    );

    const event = insertResult.rows[0];

    // Automatically RSVP creator as attending
    await db.query(
      `INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)`,
      [event.id, req.user!.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Event scheduled successfully.',
      data: { event },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/events/:eventId/rsvp
 */
router.post('/events/:eventId/rsvp', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { eventId } = req.params;

    const eventResult = await db.query<Event>(
      'SELECT id, group_id FROM events WHERE id = $1',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' },
      });
    }

    const event = eventResult.rows[0];

    const membership = await db.query<GroupMembership>(
      'SELECT id FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [event.group_id, req.user!.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Must be a group member to RSVP to events.' },
      });
    }

    const existingRsvp = await db.query(
      'SELECT id FROM event_attendees WHERE event_id = $1 AND user_id = $2',
      [eventId, req.user!.id]
    );

    if (existingRsvp.rows.length > 0) {
      await db.query(
        'DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2',
        [eventId, req.user!.id]
      );
      return res.status(200).json({
        success: true,
        message: 'RSVP cancelled successfully.',
        data: { is_attending: false },
      });
    }

    await db.query(
      'INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)',
      [eventId, req.user!.id]
    );

    return res.status(200).json({
      success: true,
      message: 'RSVP submitted successfully!',
      data: { is_attending: true },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/events/my
 */
router.get('/events/my', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const result = await db.query<Event>(
      `SELECT e.id, e.group_id, e.created_by, e.title, e.description, e.location, e.start_time, e.end_time, e.created_at,
              sg.title AS group_title, u.full_name AS creator_name,
              COUNT(ea.id)::int AS attendee_count,
              TRUE AS is_attending
       FROM event_attendees my_ea
       JOIN events e ON my_ea.event_id = e.id
       JOIN study_groups sg ON e.group_id = sg.id
       JOIN users u ON e.created_by = u.id
       LEFT JOIN event_attendees ea ON e.id = ea.event_id
       WHERE my_ea.user_id = $1
       GROUP BY e.id, sg.title, u.full_name
       ORDER BY e.start_time ASC`,
      [req.user!.id]
    );

    return res.status(200).json({
      success: true,
      data: { events: result.rows },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/groups/:groupId/events/:eventId
 * Owner, Admin, or event creator can delete an event.
 */
router.delete('/groups/:groupId/events/:eventId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const groupId = req.params.groupId as string;
    const eventId = req.params.eventId as string;

    const eventResult = await db.query<Event>(
      'SELECT id, created_by FROM events WHERE id = $1 AND group_id = $2',
      [eventId, groupId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' },
      });
    }

    const event = eventResult.rows[0];
    const isCreator = event.created_by === req.user!.id;

    if (!isCreator) {
      const membership = await db.query<GroupMembership>(
        'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
        [groupId, req.user!.id]
      );

      if (membership.rows.length === 0 || !['owner', 'admin'].includes(membership.rows[0].role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only group owners, admins, or event creators can delete events.' },
        });
      }
    }

    await db.query('DELETE FROM events WHERE id = $1 AND group_id = $2', [eventId, groupId]);

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;

