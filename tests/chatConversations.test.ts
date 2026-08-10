process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server';

let server: http.Server;
const PORT = 4199;

function request(method: string, path: string, body?: any, cookie?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:${PORT}/api/v1` + path);
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
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsedBody = data;
        try {
          parsedBody = JSON.parse(data);
        } catch (e) {}
        resolve({
          status: res.statusCode || 500,
          headers: res.headers,
          body: parsedBody,
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

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runTests() {
  console.log('\n=================================================');
  console.log('  STARTING EVENT DELETION & CONVERSATIONS TESTS  ');
  console.log('=================================================\n');

  server = app.listen(PORT);

  // 1. Create owner user & login
  const ownerEmail = `owner.${Date.now()}@stanford.edu`;
  await request('POST', '/auth/signup', {
    email: ownerEmail,
    password: 'Password123!',
    full_name: 'Group Owner',
  });

  const loginRes = await request('POST', '/auth/login', {
    email: ownerEmail,
    password: 'Password123!',
  });
  const setCookie = loginRes.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie || '';

  // 2. Create study group
  console.log('1. Creating Study Group...');
  const groupRes = await request('POST', '/groups', {
    title: 'Advanced Computer Architecture',
    description: 'Hardware design and CPU architecture study group',
  }, cookie);
  assert(groupRes.status === 201, 'Group creation should succeed');
  const groupId = groupRes.body.data.group.id;
  console.log(`   ✓ Group created with ID: ${groupId}`);

  // 3. Schedule event and delete event
  console.log('\n2. Testing Event Creation & Deletion...');
  const eventRes = await request('POST', `/groups/${groupId}/events`, {
    title: 'Pipeline Architecture Review',
    start_time: new Date(Date.now() + 86400000).toISOString(),
    location: 'Engineering Building 101',
  }, cookie);
  assert(eventRes.status === 201, 'Event creation should succeed');
  const eventId = eventRes.body.data.event.id;
  console.log(`   ✓ Event created with ID: ${eventId}`);

  const deleteEventRes = await request('DELETE', `/groups/${groupId}/events/${eventId}`, undefined, cookie);
  assert(deleteEventRes.status === 200, 'Event deletion should return 200');
  console.log('   ✓ Event deleted successfully by group owner');

  // 4. Test Multi-Conversation Group Chat
  console.log('\n3. Testing Multi-Conversation Chat Topics...');
  const convsRes = await request('GET', `/groups/${groupId}/conversations`, undefined, cookie);
  assert(convsRes.status === 200, 'Getting conversations should return 200');
  assert(convsRes.body.data.conversations.length > 0, 'Group should have default General conversation');
  const defaultConvId = convsRes.body.data.conversations[0].id;
  console.log(`   ✓ Conversations retrieved. Default 'General' topic ID: ${defaultConvId}`);

  // Create custom conversation topic
  console.log('   - Creating new conversation topic "Homework Help"...');
  const createTopicRes = await request('POST', `/groups/${groupId}/conversations`, {
    title: 'Homework Help',
  }, cookie);
  assert(createTopicRes.status === 201, 'Creating topic should return 201');
  const hwTopicId = createTopicRes.body.data.conversation.id;
  console.log(`   ✓ Created topic "Homework Help" with ID: ${hwTopicId}`);

  // Post message to "Homework Help" topic
  const msgRes = await request('POST', `/groups/${groupId}/messages`, {
    content: 'Can someone explain problem 3 on cache mapping?',
    conversation_id: hwTopicId,
  }, cookie);
  assert(msgRes.status === 201, 'Posting message to topic should return 201');
  console.log('   ✓ Message posted to "Homework Help" topic');

  // Filter messages by conversation_id
  const topicMsgsRes = await request('GET', `/groups/${groupId}/messages?conversation_id=${hwTopicId}`, undefined, cookie);
  assert(topicMsgsRes.status === 200, 'Filtering messages by conversation should return 200');
  assert(topicMsgsRes.body.data.messages.length === 1, 'Should contain exactly 1 message in Homework Help');
  console.log('   ✓ Verified message filtering by conversation topic');

  // Delete conversation topic
  console.log('   - Deleting conversation topic "Homework Help"...');
  const deleteTopicRes = await request('DELETE', `/groups/${groupId}/conversations/${hwTopicId}`, undefined, cookie);
  assert(deleteTopicRes.status === 200, 'Deleting conversation topic should return 200');
  console.log('   ✓ Topic deleted successfully by owner');

  console.log('\n=================================================');
  console.log('  ALL EVENT DELETION & CONVERSATION TESTS PASSED! ');
  console.log('=================================================\n');
  server.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  if (server) server.close();
  process.exit(1);
});
