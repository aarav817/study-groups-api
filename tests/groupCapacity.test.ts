import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';

// Disconnect Redis before making requests: notifications stay in memory,
// and no email worker runs in this test.
process.env.REDIS_URL = 'redis://127.0.0.1:1';
const { redis } = require('../src/redis');
redis.disconnect();
const { pool } = require('../src/db');
const { createSession } = require('../src/middleware/auth');
const groups = require('../src/routes/groups').default;
const memberships = require('../src/routes/memberships').default;

async function run() {
  const app = express();
  app.use(express.json());
  app.use('/groups', groups);
  app.use('/', memberships);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const users: string[] = [];
  const tokens: string[] = [];
  const title = `Capacity test ${crypto.randomUUID()}`;

  async function request(method: string, path: string, body?: object, user = 0) {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[user]}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any };
  }

  try {
    for (let i = 0; i < 3; i++) {
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO users (id, email, password_hash, full_name, messaging_code, is_verified)
         VALUES ($1, $2, 'unused-test-password', 'Capacity test user', $3, true)`,
        [id, `${id}@example.invalid`, crypto.randomBytes(3).toString('hex')]
      );
      users.push(id);
      tokens.push(createSession(id));
    }

    for (const max_members of [0, -1, 1.5, '5', true, 2147483648]) {
      assert.equal((await request('POST', '/groups', { title, max_members })).status, 400);
    }
    const created = await request('POST', '/groups', { title, max_members: 2 });
    assert.equal(created.status, 201);
    const group = created.body.data.group;
    assert.equal(group.max_members, 2);

    const ownList = await request('GET', `/groups?q=${encodeURIComponent(title)}`);
    assert.equal(ownList.body.data.groups[0].max_members, 2);
    const publicList = await request('GET', `/groups?public=true&q=${encodeURIComponent(title)}`);
    assert.equal(publicList.body.data.groups[0].member_count, 1);
    assert.equal(publicList.body.data.groups[0].max_members, 2);

    // Two requests compete for one remaining place.
    const joins = await Promise.all([
      request('POST', `/groups/${group.id}/members`, undefined, 1),
      request('POST', `/groups/${group.id}/members`, undefined, 2),
    ]);
    assert.deepEqual(joins.map((r) => r.status).sort(), [201, 400]);
    const waitingUser = joins[0].status === 400 ? 1 : 2;
    const joinedUser = waitingUser === 1 ? 2 : 1;
    assert.equal(joins[waitingUser - 1].body.error.code, 'GROUP_FULL');

    const invite = await request('POST', `/groups/${group.id}/invites`);
    const invitePath = `/invites/${invite.body.data.invite.token}/join`;
    const fullInvite = await request('POST', invitePath, undefined, waitingUser);
    assert.equal(fullInvite.body.error.code, 'GROUP_FULL');
    assert.equal((await request('PATCH', `/groups/${group.id}`, { max_members: 1 })).status, 400);
    assert.equal((await request('PATCH', `/groups/${group.id}`, { max_members: 1.5 })).status, 400);
    assert.equal((await request('PATCH', `/groups/${group.id}`, { max_members: 5 }, joinedUser)).status, 403);

    assert.equal((await request('PATCH', `/groups/${group.id}`, { max_members: null })).status, 200);
    assert.equal((await request('POST', invitePath, undefined, waitingUser)).status, 201);
    const details = await request('GET', `/groups/${group.id}`);
    assert.equal(details.body.data.group.max_members, null);
    assert.equal(details.body.data.group.member_count, 3);
    const refreshed = await request('GET', `/groups?public=true&q=${encodeURIComponent(title)}`);
    assert.equal(refreshed.body.data.groups[0].max_members, null);
    assert.equal(refreshed.body.data.groups[0].member_count, 3);

    const defaultGroup = await request('POST', '/groups', { title: `${title} default` });
    assert.equal(defaultGroup.body.data.group.max_members, 20);
    const unlimited = await request('POST', '/groups', { title: `${title} unlimited`, max_members: null });
    assert.equal(unlimited.status, 201);
    assert.equal(unlimited.body.data.group.max_members, null);
    const solo = await request('POST', '/groups', { title: `${title} solo`, max_members: 1 });
    assert.equal((await request('POST', `/groups/${solo.body.data.group.id}/members`, undefined, 1)).body.error.code, 'GROUP_FULL');
    console.log('PASS: capacity validation, persistence, lists, concurrent joins, invites, updates, and unlimited groups.');
  } finally {
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
}

run().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
