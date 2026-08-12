import sgMail from '@sendgrid/mail';
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
 * Initialize SendGrid if API key is available.
 */
function initSendGrid(): boolean {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return false;
  sgMail.setApiKey(apiKey);
  return true;
}

/**
 * Helper to get a configured Nodemailer SMTP transporter (local dev fallback).
 */
function getTransporter(): nodemailer.Transporter | null {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();

  if (!user || !pass) return null;

  const isGmail = host.includes('gmail.com') || (!host && user.includes('gmail.com'));
  const effectiveHost = isGmail ? 'smtp.gmail.com' : (host || 'smtp.gmail.com');
  const effectivePort = port || 587;

  return nodemailer.createTransport({
    host: effectiveHost,
    port: effectivePort,
    secure: effectivePort === 465,
    requireTLS: effectivePort !== 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  } as nodemailer.TransportOptions);
}

/**
 * Core email sending function.
 * Priority: SendGrid HTTP API → SMTP fallback (local dev).
 */
async function sendEmail(
  to: string,
  subject: string,
  textBody: string,
  htmlBody: string
): Promise<void> {
  const hasSendGrid = initSendGrid();
  const fromAddress = process.env.SENDGRID_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@studygroups.app';

  // 1. Try SendGrid HTTP API (works on Railway — uses HTTPS port 443)
  if (hasSendGrid) {
    console.log(`[EmailService] Sending via SendGrid API to ${to}...`);
    try {
      const [response] = await sgMail.send({
        to,
        from: fromAddress,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`[EmailService] ✓ Email sent via SendGrid to ${to}. Status: ${response.statusCode}`);
      return;
    } catch (err: any) {
      const body = err.response?.body;
      console.error(`[EmailService] SendGrid error for ${to}:`, body?.errors || err.message);
      throw new Error(`SendGrid Error: ${body?.errors?.[0]?.message || err.message}`);
    }
  }

  // 2. Fallback: SMTP (works locally, blocked on Railway)
  const transporter = getTransporter();
  if (transporter) {
    console.log(`[EmailService] Sending via SMTP to ${to}...`);
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`[EmailService] ✓ Email sent via SMTP to ${to}. MessageId: ${info.messageId}`);
      return;
    } catch (err: any) {
      console.error(`[EmailService] SMTP failed for ${to}: ${err.code || ''} ${err.message}`);
      throw err;
    }
  }

  // 3. No provider configured — log locally
  console.warn(`[EmailService] No email provider configured. Set SENDGRID_API_KEY (production) or SMTP_USER/SMTP_PASS (local dev).`);
  console.log(`[EmailService] TO: ${to} | SUBJECT: ${subject}`);
}

/**
 * Configure mock failure simulation for testing retries.
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

  await sendEmail(ownerEmail, subject, textBody, htmlBody);

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

  await sendEmail(userEmail, subject, textBody, htmlBody);

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
