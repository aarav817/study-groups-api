process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server';
import db from '../src/db';

let server: http.Server;
const BASE_PORT = 3999;
const BASE_URL = `http://localhost:${BASE_PORT}/api/v1`;

let aliceCookie = '';
let bobCookie = '';
let createdGroupId = '';
let inviteToken = '';

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
  console.log('  STARTING STUDY GROUPS API INTEGRATION TESTS');
  console.log('========================================\n');

  server = app.listen(BASE_PORT);

  try {
    // 1. Health check
    console.log('1. Testing /health endpoint...');
    const health = await request('GET', '/../../health');
    assert(health.status === 200, 'Health endpoint should return 200');
    assert(health.body.status === 'ok', 'Health status should be ok');
    console.log('   ✓ Health check passed');

    // 2. Signup Validation (.edu requirement)
    console.log('2. Testing Signup Validation (.edu email constraint)...');
    const invalidSignup = await request('POST', '/auth/signup', {
      email: 'student@gmail.com',
      password: 'password123',
      full_name: 'Test Student',
    });
    assert(invalidSignup.status === 400, 'Non-edu signup should return 400');
    assert(invalidSignup.body.error.code === 'VALIDATION_ERROR', 'Should return VALIDATION_ERROR');
    console.log('   ✓ Non-edu email rejected correctly');

    // 3. Signup Alice (.edu email)
    console.log('3. Testing Signup Alice (.edu email)...');
    const aliceEmail = `alice.${Date.now()}@stanford.edu`;
    const aliceSignup = await request('POST', '/auth/signup', {
      email: aliceEmail,
      password: 'Password123!',
      full_name: 'Alice Stanford',
    });
    assert(aliceSignup.status === 201, 'Alice signup should return 201');
    assert(aliceSignup.body.data.user.email === aliceEmail, 'Alice email match');
    const aliceToken = aliceSignup.body.data.verification_token;
    assert(!!aliceToken, 'Signup response should return verification token');

    const aliceVerify = await request('GET', `/auth/verify-email?token=${aliceToken}`);
    assert(aliceVerify.status === 200, 'Alice verification should succeed');
    aliceCookie = aliceVerify.headers['set-cookie'] ? aliceVerify.headers['set-cookie'][0] : '';
    assert(!!aliceCookie, 'Verification must set session_token cookie');
    console.log('   ✓ Alice signed up and verified email successfully');

    // 4. Signup Bob (.edu email)
    console.log('4. Testing Signup Bob (.edu email)...');
    const bobEmail = `bob.${Date.now()}@mit.edu`;
    const bobSignup = await request('POST', '/auth/signup', {
      email: bobEmail,
      password: 'Password123!',
      full_name: 'Bob MIT',
    });
    assert(bobSignup.status === 201, 'Bob signup should return 201');
    const bobToken = bobSignup.body.data.verification_token;

    const bobVerify = await request('GET', `/auth/verify-email?token=${bobToken}`);
    assert(bobVerify.status === 200, 'Bob verification should succeed');
    bobCookie = bobVerify.headers['set-cookie'] ? bobVerify.headers['set-cookie'][0] : '';
    console.log('   ✓ Bob signed up and verified email successfully');

    // 5. Auth /me endpoint
    console.log('5. Testing /auth/me with Alice session...');
    const meRes = await request('GET', '/auth/me', null, aliceCookie);
    assert(meRes.status === 200, 'Auth me should return 200');
    assert(meRes.body.data.user.email === aliceEmail, 'Auth me user match');
    console.log('   ✓ /auth/me returned correct user');

    // 6. Create Study Group
    console.log('6. Testing Group Creation (Alice creates Quantum Computing)...');
    const createGroupRes = await request('POST', '/groups', {
      title: 'Quantum Computing Study Group',
      description: 'Qiskit, qubits, and quantum algorithms.',
      is_public: true,
    }, aliceCookie);
    assert(createGroupRes.status === 201, 'Group creation should return 201');
    createdGroupId = createGroupRes.body.data.group.id;
    assert(!!createdGroupId, 'Created group must have an ID');
    console.log('   ✓ Group created with ID:', createdGroupId);

    // 7. Get Group Details
    console.log('7. Testing Get Group Details...');
    const groupDetails = await request('GET', `/groups/${createdGroupId}`, null, aliceCookie);
    assert(groupDetails.status === 200, 'Group details should return 200');
    assert(groupDetails.body.data.group.user_membership.role === 'owner', 'Alice should be group owner');
    console.log('   ✓ Group details verified');

    // 8. Bob joins Public Group
    console.log('8. Testing Bob joining Alice\'s group...');
    const joinRes = await request('POST', `/groups/${createdGroupId}/members`, null, bobCookie);
    assert(joinRes.status === 201, 'Bob join should return 201');
    console.log('   ✓ Bob joined group successfully');

    // 9. List Members
    console.log('9. Testing List Group Members...');
    const membersRes = await request('GET', `/groups/${createdGroupId}/members`, null, aliceCookie);
    assert(membersRes.status === 200, 'Members list should return 200');
    assert(membersRes.body.data.members.length === 2, 'Should have 2 members');
    console.log('   ✓ Group member count is 2');

    // 10. Group Chat Message
    console.log('10. Testing Group Chat Message (Bob posts message)...');
    const msgRes = await request('POST', `/groups/${createdGroupId}/messages`, {
      content: 'Hello everyone! Excited to learn quantum computing.',
    }, bobCookie);
    assert(msgRes.status === 201, 'Message post should return 201');
    console.log('   ✓ Message posted to group');

    // 11. Schedule Event
    console.log('11. Testing Event Scheduling...');
    const eventRes = await request('POST', `/groups/${createdGroupId}/events`, {
      title: 'Qiskit Lab Session',
      description: 'Hands-on coding with IBM Qiskit',
      location: 'Physics Lab 301',
      start_time: new Date(Date.now() + 86400000).toISOString(),
    }, aliceCookie);
    assert(eventRes.status === 201, 'Event creation should return 201');
    const eventId = eventRes.body.data.event.id;
    console.log('   ✓ Event created with ID:', eventId);

    // 12. Event RSVP
    console.log('12. Testing Event RSVP (Bob RSVPs)...');
    const rsvpRes = await request('POST', `/events/${eventId}/rsvp`, null, bobCookie);
    assert(rsvpRes.status === 200, 'RSVP should return 200');
    assert(rsvpRes.body.data.is_attending === true, 'Bob should be attending');
    console.log('   ✓ Bob RSVPed to event');

    // 13. Create Group Invite Link
    console.log('13. Testing Invite Link Generation...');
    const inviteRes = await request('POST', `/groups/${createdGroupId}/invites`, null, aliceCookie);
    assert(inviteRes.status === 201, 'Invite creation should return 201');
    inviteToken = inviteRes.body.data.invite.token;
    assert(!!inviteToken, 'Invite token must exist');
    console.log('   ✓ Invite link generated token:', inviteToken);

    // 14. Submit Community Report
    console.log('14. Testing Community Safety Report...');
    const reportRes = await request('POST', '/reports', {
      target_type: 'group',
      target_id: createdGroupId,
      reason: 'Testing community reporting system',
    }, bobCookie);
    assert(reportRes.status === 201, 'Report submission should return 201');
    console.log('   ✓ Report submitted successfully');

    // 15. Testing Materials Caching & Invalidation
    console.log('15. Testing Materials Caching & Invalidation...');
    const createFolderRes = await request('POST', `/groups/${createdGroupId}/material-folders`, {
      name: 'Lecture Notes',
    }, aliceCookie);
    assert(createFolderRes.status === 201, 'Folder creation should return 201');
    const folderId = createFolderRes.body.data.folder.id;

    const uploadMat1 = await request('POST', `/groups/${createdGroupId}/materials`, {
      title: 'Quantum Mechanics Lecture 1',
      file_format: 'pdf',
      file_size_bytes: 1048576,
      file_url: 'https://example.com/qm1.pdf',
      folder_id: folderId,
    }, aliceCookie);
    assert(uploadMat1.status === 201, 'Material 1 upload should return 201');

    // GET materials (populates cache)
    const matGet1 = await request('GET', `/groups/${createdGroupId}/materials`, null, aliceCookie);
    assert(matGet1.status === 200, 'Materials fetch should return 200');
    assert(matGet1.body.data.materials.length === 1, 'Should return 1 material initially');

    // GET all user materials (populates user materials cache)
    const userMatGet1 = await request('GET', '/materials/all', null, aliceCookie);
    assert(userMatGet1.status === 200, 'User materials fetch should return 200');
    assert(userMatGet1.body.data.materials.length === 1, 'User should see 1 material initially');

    // Upload Material 2 (invalidates cache)
    const uploadMat2 = await request('POST', `/groups/${createdGroupId}/materials`, {
      title: 'Qiskit Cheat Sheet',
      file_format: 'pdf',
      file_size_bytes: 524288,
      file_url: 'https://example.com/qiskit.pdf',
    }, bobCookie);
    assert(uploadMat2.status === 201, 'Material 2 upload should return 201');

    // GET materials again (should fetch fresh data, 2 materials)
    const matGet2 = await request('GET', `/groups/${createdGroupId}/materials`, null, aliceCookie);
    assert(matGet2.status === 200, 'Materials fetch should return 200');
    assert(matGet2.body.data.materials.length === 2, 'Should return 2 materials after cache invalidation');
    console.log('   ✓ Materials caching & invalidation verified successfully');

    console.log('\n========================================');
    console.log('  ALL INTEGRATION TESTS PASSED CLEANLY!  ');
    console.log('========================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await db.pool.end();
  }
}

runTests();
