import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface SentEmailRecord {
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
}

// In-memory log of dispatched emails for audit & testing
const sentEmailsLog: SentEmailRecord[] = [];

// Flag for testing retry behavior
let simulateFailuresRemaining = 0;

/**
 * Helper to get a configured Nodemailer SMTP transporter if environment variables are set.
 */
function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/**
 * Configure mock failure simulation for testing retries.
 * @param count Number of consecutive email sends to fail
 */
export function setSimulatedFailures(count: number) {
  simulateFailuresRemaining = count;
}

/**
 * Get all sent emails log.
 */
export function getSentEmails(): SentEmailRecord[] {
  return [...sentEmailsLog];
}

/**
 * Clear sent emails history (useful between test runs).
 */
export function clearSentEmails() {
  sentEmailsLog.length = 0;
  simulateFailuresRemaining = 0;
}

/**
 * Send an email notification to the group owner when a user joins their study group.
 */
export async function sendGroupJoinNotification(
  ownerEmail: string,
  ownerName: string,
  joinedUserName: string,
  groupTitle: string
): Promise<void> {
  if (simulateFailuresRemaining > 0) {
    simulateFailuresRemaining--;
    console.warn(`[EmailService] Simulated SMTP error for ${ownerEmail}. (${simulateFailuresRemaining} failures remaining)`);
    throw new Error('Simulated SMTP connection error: Failed to connect to mail gateway.');
  }

  const subject = `New Member Joined Your Study Group: ${groupTitle}`;
  const textBody = `Hi ${ownerName || 'Group Owner'},\n\nGreat news! ${joinedUserName} has just joined your study group "${groupTitle}".\n\nLog in to your account to welcome them!\n\nBest,\nStudy Groups Team`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">New Member Joined Your Study Group!</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hi <strong>${ownerName || 'Group Owner'}</strong>,</p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">Great news! <strong>${joinedUserName}</strong> has joined your study group <strong>"${groupTitle}"</strong>.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'https://study-groups.up.railway.app'}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Open Study Groups App</a>
      </div>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-bottom: 0;">Sent by Study Groups Platform</p>
    </div>
  `;

  console.log(`[EmailService] Processing group join notification for ${ownerEmail}...`);

  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || '"Study Groups" <noreply@studygroups.app>';

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: ownerEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`[EmailService] Real email successfully sent via SMTP to ${ownerEmail}.`);
    } catch (err: any) {
      console.error(`[EmailService] Failed to send SMTP email to ${ownerEmail}:`, err.message);
      throw err;
    }
  } else {
    console.log(`[EmailService] SMTP not configured. Logged notification locally for ${ownerEmail}.`);
  }

  sentEmailsLog.push({
    to: ownerEmail,
    subject,
    body: textBody,
    sentAt: new Date(),
  });
}

/**
 * Send an account verification email containing the verification link.
 */
export async function sendAccountVerificationEmail(
  userEmail: string,
  userName: string,
  verificationUrl: string
): Promise<void> {
  if (simulateFailuresRemaining > 0) {
    simulateFailuresRemaining--;
    console.warn(`[EmailService] Simulated SMTP error for ${userEmail}. (${simulateFailuresRemaining} failures remaining)`);
    throw new Error('Simulated SMTP connection error: Failed to connect to mail gateway.');
  }

  const subject = 'Verify Your Study Groups Account Email';
  const textBody = `Hi ${userName || 'User'},\n\nWelcome to Study Groups! Please verify your email address to complete your account registration.\n\nClick the link below to finish account creation:\n${verificationUrl}\n\nIf you did not create an account, please ignore this email.\n\nBest,\nStudy Groups Team`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Welcome to Study Groups!</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hi <strong>${userName || 'User'}</strong>,</p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">Please verify your email address to complete your registration.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${verificationUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify Email Address</a>
      </div>
      <p style="color: #64748b; font-size: 13px; word-break: break-all;">Or copy and paste this URL into your browser:<br/><a href="${verificationUrl}" style="color: #4f46e5;">${verificationUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-bottom: 0;">Sent by Study Groups Platform</p>
    </div>
  `;

  console.log(`[EmailService] Processing verification email for ${userEmail}...`);

  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || '"Study Groups" <noreply@studygroups.app>';

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: userEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`[EmailService] Real verification email successfully sent via SMTP to ${userEmail}.`);
    } catch (err: any) {
      console.error(`[EmailService] Failed to send verification email to ${userEmail}:`, err.message);
      throw err;
    }
  } else {
    console.log(`[EmailService] SMTP not configured. Logged verification link locally for ${userEmail}: ${verificationUrl}`);
  }

  sentEmailsLog.push({
    to: userEmail,
    subject,
    body: textBody,
    sentAt: new Date(),
  });
}

export default {
  sendGroupJoinNotification,
  sendAccountVerificationEmail,
  setSimulatedFailures,
  getSentEmails,
  clearSentEmails,
};
