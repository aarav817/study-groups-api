import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import db from '../db';
import { User, AuthenticatedRequest } from '../types';

// In-memory session store (session_token -> user_id)
const sessions = new Map<string, string>();

/**
 * Creates a new session token for a given user ID.
 */
export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, userId);
  return token;
}

/**
 * Removes a session token.
 */
export function removeSession(token?: string | null): void {
  if (token) {
    sessions.delete(token);
  }
}

/**
 * Helper to generate a unique 6-character uppercase alphanumeric messaging code.
 */
export async function generateMessagingCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  while (true) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await db.query('SELECT id FROM users WHERE messaging_code = $1', [code]);
    if (existing.rows.length === 0) return code;
  }
}

/**
 * Express middleware to enforce authentication via session_token cookie or Bearer token.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    let token: string | undefined = req.cookies ? req.cookies.session_token : undefined;

    // Fallback to Authorization header if present
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please log in.',
        },
      });
    }

    const userId = sessions.get(token);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Session invalid or expired. Please log in again.',
        },
      });
    }

    // Fetch user details from database
    const userResult = await db.query<User>(
      `SELECT id, email, full_name, avatar_url, bio, messaging_code, is_verified, is_admin, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      removeSession(token);
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account no longer exists.',
        },
      });
    }

    const user = userResult.rows[0];

    // Auto-heal missing or blank messaging_code
    if (!user.messaging_code || !user.messaging_code.trim()) {
      const newCode = await generateMessagingCode();
      await db.query('UPDATE users SET messaging_code = $1 WHERE id = $2', [newCode, user.id]);
      user.messaging_code = newCode;
    }

    req.user = user;
    req.sessionToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Express middleware to enforce platform developer / system administrator access.
 * Checks for X-Admin-Key header or is_admin == true flag on the user account.
 */
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  const adminSecretKey = process.env.ADMIN_SECRET_KEY || 'dev_admin_secret';
  const providedKey = req.headers['x-admin-key'] || req.query.admin_key;

  // Developer API Key bypass
  if (providedKey === adminSecretKey) {
    return next();
  }

  await requireAuth(req, res, async () => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        });
      }

      // Check if user has platform developer / system administrator privilege
      if (req.user.is_admin === true) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: Platform developer / system administrator access required.',
        },
      });
    } catch (err) {
      next(err);
    }
  });
}

/**
 * Express middleware for optional authentication (populates req.user if session valid, but doesn't block unauthenticated requests).
 */
export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined = req.cookies ? req.cookies.session_token : undefined;

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }

    if (token) {
      const userId = sessions.get(token);
      if (userId) {
        const userResult = await db.query<User>(
          `SELECT id, email, full_name, avatar_url, bio, messaging_code, created_at, updated_at
           FROM users WHERE id = $1`,
          [userId]
        );
        if (userResult.rows.length > 0) {
          req.user = userResult.rows[0];
          req.sessionToken = token;
        }
      }
    }
    next();
  } catch (err) {
    next();
  }
}

export default {
  createSession,
  removeSession,
  requireAuth,
  requireAdmin,
  optionalAuth,
  generateMessagingCode,
};
