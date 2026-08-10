process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server';
import db from '../src/db';
import { validateEmail } from '../src/utils/emailValidator';
import emailQueue from '../src/queue/emailQueue';
import emailService from '../src/services/emailService';
import { EmailWorker } from '../src/worker/emailWorker';

let server: http.Server;
const PORT = 4099;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

function request(method: string, path: string, body?: any, cookie?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        let parsed = responseData;
        try {
          parsed = JSON.parse(responseData);
        } catch (e) {}
        resolve({
          status: res.statusCode || 500,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('  STARTING EMAIL QUEUE & WORKER TESTS');
  console.log('========================================\n');

  server = app.listen(PORT);

  try {
    // 1. Email Verification Unit / Utility Tests
    console.log('1. Testing validateEmail utility...');
    const invalidSyntax = await validateEmail('not-an-email');
    assert(!invalidSyntax.valid, 'Invalid email syntax should be rejected');

    const nonEdu = await validateEmail('user@gmail.com');
    assert(!nonEdu.valid, 'Non-edu email should be rejected');

    const validEdu = await validateEmail('alex@stanford.edu');
    assert(validEdu.valid, 'Valid .edu email should be accepted');
    console.log('   ✓ validateEmail utility tests passed');

    // 2. Signup Email Validation via API
    console.log('2. Testing signup API email validation rejection...');
    const badSignup = await request('POST', '/auth/signup', {
      email: 'baduser@gmail.com',
      password: 'Password123!',
      full_name: 'Bad Email User',
    });
    assert(badSignup.status === 400, 'Non-edu email signup must return 400');
    assert(badSignup.body.error.code === 'VALIDATION_ERROR', 'Should return VALIDATION_ERROR');
    console.log('   ✓ Signup email validation API test passed');

    // 3. Setup Owner and Joining Member Users with Email Verification
    console.log('3. Testing account verification flow on signup...');
    const timestamp = Date.now();
    const ownerEmail = `owner.${timestamp}@stanford.edu`;
    const joinerEmail = `joiner.${timestamp}@stanford.edu`;

    const ownerRes = await request('POST', '/auth/signup', {
      email: ownerEmail,
      password: 'Password123!',
      full_name: 'Group Owner Alex',
    });
    assert(ownerRes.status === 201, 'Owner signup should succeed');
    const ownerToken = ownerRes.body.data.verification_token;
    assert(!!ownerToken, 'Owner signup must return verification token');

    // Login succeeds without requiring email verification
    const unverifiedLogin = await request('POST', '/auth/login', {
      email: ownerEmail,
      password: 'Password123!',
    });
    assert(unverifiedLogin.status === 200, 'User login succeeds without blocking on email verification');
    console.log('   ✓ Login succeeds directly without email verification gating');

    // Complete account verification via verify-email endpoint
    const ownerVerify = await request('GET', `/auth/verify-email?token=${ownerToken}`);
    assert(ownerVerify.status === 200, 'Owner email verification must return 200');
    assert(ownerVerify.body.data.user.is_verified === true, 'User is_verified should be true');
    const ownerCookie = ownerVerify.headers['set-cookie'] ? ownerVerify.headers['set-cookie'][0] : '';
    assert(!!ownerCookie, 'Email verification must establish session token cookie');
    console.log('   ✓ Owner email verification completed successfully');

    // Joiner signup & verification
    const joinerRes = await request('POST', '/auth/signup', {
      email: joinerEmail,
      password: 'Password123!',
      full_name: 'Joining Member Sam',
    });
    assert(joinerRes.status === 201, 'Joiner signup should succeed');
    const joinerToken = joinerRes.body.data.verification_token;

    const joinerVerify = await request('GET', `/auth/verify-email?token=${joinerToken}`);
    assert(joinerVerify.status === 200, 'Joiner verification should succeed');
    const joinerCookie = joinerVerify.headers['set-cookie'] ? joinerVerify.headers['set-cookie'][0] : '';
    console.log('   ✓ Joiner email verification completed successfully');

    // 4. Owner creates a Study Group
    console.log('4. Owner creating study group...');
    const groupRes = await request('POST', '/groups', {
      title: `Algorithms Study Group ${timestamp}`,
      description: 'Preparing for technical interviews',
      is_public: true,
    }, ownerCookie);
    assert(groupRes.status === 201, 'Group creation should succeed');
    const groupId = groupRes.body.data.group.id;
    console.log(`   ✓ Group created with ID ${groupId}`);

    // Clear queues and email logs prior to join test
    await emailQueue.clearQueues();
    emailService.clearSentEmails();

    // 5. Joiner joins Study Group via API (non-blocking verification)
    console.log('5. Joiner joining group via API...');
    const joinStartTime = Date.now();
    const joinResponse = await request('POST', `/groups/${groupId}/members`, {}, joinerCookie);
    const joinDuration = Date.now() - joinStartTime;

    assert(joinResponse.status === 201, 'Join group should return 201 Created');
    assert(joinDuration < 1000, `Join group API response must return immediately without blocking (took ${joinDuration}ms)`);
    console.log(`   ✓ Join group API returned 201 Created in ${joinDuration}ms (non-blocking)`);

    // Give async task trigger a moment to enqueue
    await new Promise((r) => setTimeout(r, 100));

    const queueLen = await emailQueue.getQueueLength();
    assert(queueLen >= 1, `Queue should contain enqueued join notification job (found ${queueLen})`);
    console.log(`   ✓ Task successfully pushed to queue asynchronously (Pending jobs: ${queueLen})`);

    // 6. Test Worker Processing
    console.log('6. Testing Worker processing job from queue...');
    const testWorker = new EmailWorker(100, 3);
    const processed = await testWorker.processNextJob();
    assert(processed, 'Worker should process job from queue');

    const sentEmails = emailService.getSentEmails();
    assert(sentEmails.length === 1, 'Worker should have sent 1 email notification');
    assert(sentEmails[0].to === ownerEmail, `Notification sent to group owner ${ownerEmail}`);
    assert(sentEmails[0].body.includes('Joining Member Sam'), 'Email body contains joiner name');
    console.log('   ✓ Worker successfully fulfilled job and delivered email notification to group owner');

    // 7. Test Retry Mechanism (3 retries policy)
    console.log('7. Testing worker retry mechanism (failed emails retried 3 times)...');
    await emailQueue.clearQueues();
    emailService.clearSentEmails();

    // Enqueue a job manually
    const testJob = await emailQueue.enqueueJoinNotification({
      groupId,
      groupTitle: 'Retry Test Group',
      ownerUserId: 'owner_123',
      ownerEmail: 'owner.retry@stanford.edu',
      ownerName: 'Retry Owner',
      joinedUserId: 'joiner_123',
      joinedUserName: 'Retry Member',
    });

    // Configure 2 simulated SMTP failures then success on 3rd attempt
    emailService.setSimulatedFailures(2);

    // Attempt 1: Fails -> increment attempts (1), re-enqueue
    console.log('   - Executing Attempt 1 (Simulated failure)...');
    const run1 = await testWorker.processNextJob();
    assert(!run1, 'Attempt 1 should fail due to simulated error');

    // Attempt 2: Fails -> increment attempts (2), re-enqueue
    console.log('   - Executing Attempt 2 (Simulated failure)...');
    const run2 = await testWorker.processNextJob();
    assert(!run2, 'Attempt 2 should fail due to simulated error');

    // Attempt 3: Succeeds -> sent email
    console.log('   - Executing Attempt 3 (Recovery success)...');
    const run3 = await testWorker.processNextJob();
    assert(run3, 'Attempt 3 should succeed after retries');

    const retriedEmails = emailService.getSentEmails();
    assert(retriedEmails.length === 1, 'Email delivered on 3rd attempt');
    console.log('   ✓ Retry mechanism successfully retried failed email and recovered on 3rd attempt');

    // Test Max Retries Exhaustion (3 failures -> dead letter queue)
    console.log('   - Testing max 3 retries exhaustion moving to dead-letter queue...');
    await emailQueue.clearQueues();
    emailService.clearSentEmails();

    await emailQueue.enqueueJoinNotification({
      groupId,
      groupTitle: 'Max Retries Test Group',
      ownerUserId: 'owner_456',
      ownerEmail: 'owner.fail@stanford.edu',
      ownerName: 'Fail Owner',
      joinedUserId: 'joiner_456',
      joinedUserName: 'Fail Member',
    });

    emailService.setSimulatedFailures(5); // More failures than max retries

    // Attempt 1 (attempt 0 -> 1)
    await testWorker.processNextJob();
    // Attempt 2 (attempt 1 -> 2)
    await testWorker.processNextJob();
    // Attempt 3 (attempt 2 -> 3 >= maxRetries -> dead letter queue)
    await testWorker.processNextJob();

    const failedLen = await emailQueue.getFailedQueueLength();
    assert(failedLen === 1, `Job should be moved to dead-letter queue after 3 failed attempts (found ${failedLen})`);
    console.log('   ✓ Max retry exhaustion correctly moved job to dead-letter queue');

    console.log('\n========================================');
    console.log('  ALL EMAIL QUEUE & WORKER TESTS PASSED');
    console.log('========================================\n');
  } catch (err) {
    console.error('\nTEST FAILED WITH ERROR:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await db.pool.end();
  }
}

runTests();
