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
    const frontendUrl = process.env.FRONTEND_URL || (req.headers.origin ? req.headers.origin : `https://${req.get('host')}`);
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    // Queue verification email notification
    await enqueueAccountVerification({
      userId: user.id,
      userEmail: user.email,
      userName: user.full_name,
      token: verificationToken,
      verificationUrl,
    });

    delete user.password_hash;

    return res.status(201).json({
      success: true,
      message: 'Account created! Please check your email address and click the verification link to finish account creation.',
      data: { user, requires_verification: true },
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

    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        },
      });
    }

    delete user.password_hash;
    const sessionToken = createSession(user.id);
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: isProd ? 'none' : 'lax',
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
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: isProd ? 'none' : 'lax',
    });

    if (req.headers.accept?.includes('text/html')) {
      const frontendUrl = process.env.FRONTEND_URL || (req.headers.origin ? req.headers.origin : '');
      if (frontendUrl) {
        return res.redirect(`${frontendUrl}/groups?verified=true`);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. Account creation complete!',
      data: { user, session_token: sessionToken },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/resend-verification
 * Resend account verification email.
 */
router.post('/resend-verification', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email address is required.',
        },
      });
    }

    const userResult = await db.query<User>(
      'SELECT id, email, full_name, is_verified, verification_token FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'If an unverified account exists for this email, a verification link has been sent.',
      });
    }

    const user = userResult.rows[0];
    if (user.is_verified) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_VERIFIED',
          message: 'This email address has already been verified. Please sign in.',
        },
      });
    }

    let verificationToken = user.verification_token;
    if (!verificationToken) {
      verificationToken = crypto.randomBytes(32).toString('hex');
      await db.query('UPDATE users SET verification_token = $1 WHERE id = $2', [verificationToken, user.id]);
    }

    const frontendUrl = process.env.FRONTEND_URL || (req.headers.origin ? req.headers.origin : `https://${req.get('host')}`);
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    await enqueueAccountVerification({
      userId: user.id,
      userEmail: user.email,
      userName: user.full_name,
      token: verificationToken,
      verificationUrl,
    });

    return res.status(200).json({
      success: true,
      message: 'A new verification email has been queued and sent to your inbox!',
    });
  } catch (err) {
    next(err);
  }
});
