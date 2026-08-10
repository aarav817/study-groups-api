import express, { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db';
import { createSession, removeSession, requireAuth, generateMessagingCode } from '../middleware/auth';
import { AuthenticatedRequest, User } from '../types';
import { validateEmail } from '../utils/emailValidator';
import { enqueueAccountVerification } from '../queue/emailQueue';

const router = express.Router();

/**
 * POST /api/v1/auth/signup
 */
router.post('/signup', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { email, password, full_name } = req.body || {};

    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters provided.',
          details: [
            !email && { field: 'email', issue: 'Email is required.' },
            !password && { field: 'password', issue: 'Password is required.' },
            !full_name && { field: 'full_name', issue: 'Full name is required.' },
          ].filter(Boolean),
        },
      });
    }

    const emailValidation = await validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters provided.',
          details: [{ field: 'email', issue: emailValidation.reason || 'Invalid email address.' }],
        },
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters provided.',
          details: [{ field: 'password', issue: 'Password must be at least 8 characters long.' }],
        },
      });
    }

    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const messagingCode = await generateMessagingCode();
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const insertResult = await db.query<User>(
      `INSERT INTO users (email, password_hash, full_name, messaging_code, is_verified, verification_token)
       VALUES ($1, $2, $3, $4, FALSE, $5)
       RETURNING id, email, full_name, avatar_url, bio, messaging_code, is_verified, created_at, updated_at`,
      [email.toLowerCase().trim(), passwordHash, full_name.trim(), messagingCode, verificationToken]
    );

    const user = insertResult.rows[0];
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const verificationUrl = `${protocol}://${host}/api/v1/auth/verify-email?token=${verificationToken}`;

    // Queue verification email notification
    await enqueueAccountVerification({
      userId: user.id,
      userEmail: user.email,
      userName: user.full_name,
      token: verificationToken,
      verificationUrl,
    });

    return res.status(201).json({
      success: true,
      message: 'Account registered! Please check your email and click the verification link to finish account creation.',
      data: { user, verification_token: verificationToken },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/login
 */
router.post('/login', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required.',
        },
      });
    }

    const userResult = await db.query<User>(
      'SELECT id, email, password_hash, full_name, avatar_url, bio, messaging_code, is_verified, created_at, updated_at FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash || '');
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }

    delete user.password_hash;
    const sessionToken = createSession(user.id);

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: { user, session_token: sessionToken },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/logout
 */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  if (req.sessionToken) {
    removeSession(req.sessionToken);
  }
  res.clearCookie('session_token');
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

/**
 * GET /api/v1/auth/me
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  return res.status(200).json({
    success: true,
    data: { user: req.user },
  });
});

export default router;

/**
 * GET /api/v1/auth/verify-email
 * Verifies account via token to finish account creation.
 */
router.get('/verify-email', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const token = (req.query.token as string) || req.body?.token;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Verification token is required.',
        },
      });
    }

    const userResult = await db.query<User>(
      `UPDATE users
       SET is_verified = TRUE, verification_token = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE verification_token = $1
       RETURNING id, email, full_name, avatar_url, bio, messaging_code, is_verified, created_at, updated_at`,
      [token.trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_VERIFICATION_TOKEN',
          message: 'Invalid or expired account verification token.',
        },
      });
    }

    const user = userResult.rows[0];
    const sessionToken = createSession(user.id);

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. Account creation complete!',
      data: { user, session_token: sessionToken },
    });
  } catch (err) {
    next(err);
  }
});
