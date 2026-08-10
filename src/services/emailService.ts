/**
 * Email Service responsible for formatting and delivering email notifications.
 */

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
 * Configure mock failure simulation for testing retries.
 * @param count Number of consecutive email sends to fail
 */
export function setSimulatedFailures(count: number) {
  simulateFailuresRemaining = count;
}

/**
 * Get all sent emails.
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
  const body = `Hi ${ownerName || 'Group Owner'},\n\nGreat news! ${joinedUserName} has just joined your study group "${groupTitle}".\n\nLog in to your account to welcome them!\n\nBest,\nStudy Groups Team`;

  console.log(`[EmailService] Sending email to ${ownerEmail}... Subject: "${subject}"`);

  // Record sent email
  sentEmailsLog.push({
    to: ownerEmail,
    subject,
    body,
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
  const body = `Hi ${userName || 'User'},\n\nWelcome to Study Groups! Please verify your email address to complete your account registration.\n\nClick the link below to finish account creation:\n${verificationUrl}\n\nIf you did not create an account, please ignore this email.\n\nBest,\nStudy Groups Team`;

  console.log(`[EmailService] Sending verification email to ${userEmail}... Link: ${verificationUrl}`);

  sentEmailsLog.push({
    to: userEmail,
    subject,
    body,
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
