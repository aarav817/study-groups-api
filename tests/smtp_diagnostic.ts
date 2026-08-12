import nodemailer from 'nodemailer';

/**
 * Quick standalone SMTP diagnostic script.
 * Tests whether Gmail SMTP credentials work locally.
 */
async function testSmtp() {
  const user = 'emails.studygroups@gmail.com';
  const pass = 'eolxepnbdekgliia';
  
  console.log('=== SMTP Diagnostic ===');
  console.log(`Host: smtp.gmail.com`);
  console.log(`Port: 587`);
  console.log(`User: ${user}`);
  console.log(`Pass: ${pass.substring(0, 4)}...`);
  console.log('');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    debug: true,
    logger: true,
  });

  try {
    console.log('[1] Verifying SMTP connection...');
    await transporter.verify();
    console.log('[1] ✓ SMTP connection verified successfully!\n');
  } catch (err: any) {
    console.error('[1] ✗ SMTP verify FAILED:', err.message);
    console.error('    Full error:', err);
    process.exit(1);
  }

  try {
    console.log('[2] Sending test email to emails.studygroups@gmail.com...');
    const info = await transporter.sendMail({
      from: `"Study Groups" <${user}>`,
      to: user, // send to self
      subject: 'SMTP Diagnostic Test',
      text: 'If you see this, SMTP is working!',
      html: '<p>If you see this, <strong>SMTP is working!</strong></p>',
    });
    console.log('[2] ✓ Email sent! Message ID:', info.messageId);
    console.log('    Response:', info.response);
  } catch (err: any) {
    console.error('[2] ✗ Send FAILED:', err.message);
    console.error('    Code:', err.code);
    console.error('    Full error:', err);
  }

  process.exit(0);
}

testSmtp();
