import http from 'http';
import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import app from '../src/server';

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST || '/run/postgresql',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'study_groups',
  user: process.env.PGUSER || undefined,
  ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
});

const PORT = 3888;
const TARGET_GROUP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; // CS 101 Study Group

function postRequest(path: string, cookie: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch (e) {}
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('========================================');
  console.log(' Starting Concurrency Lock Benchmark    ');
  console.log(' Target Group: CS 101 Study Group');
  console.log(` Group ID: ${TARGET_GROUP_ID}`);
  console.log('========================================\n');

  // 1. Start HTTP Server
  const server = app.listen(PORT);

  try {
    // Check starting member count
    const initialRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM group_memberships WHERE group_id = $1',
      [TARGET_GROUP_ID]
    );
    const initialCount = initialRes.rows[0].count;
    console.log(`[1] Starting Member Count: ${initialCount} member(s).`);

    // 2. Create 50 distinct test users & session tokens
    console.log('[2] Creating 50 test users & active session cookies...');
    const hash = await bcrypt.hash('Password123!', 10);
    const sessions: string[] = [];

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    for (let i = 1; i <= 50; i++) {
      const uId = crypto.randomUUID();
      const email = `concurrency_user_${i}_${Date.now()}@stanford.edu`;
      let code = '';
      for (let c = 0; c < 6; c++) code += chars.charAt(Math.floor(Math.random() * chars.length));

      await pool.query(
        `INSERT INTO users (id, email, password_hash, full_name, messaging_code)
         VALUES ($1, $2, $3, $4, $5)`,
        [uId, email, hash, `Concurrency User ${i}`, code]
      );

      // Create session in server auth middleware store via login endpoint or direct session
      // Let's call /api/v1/auth/login to get proper session cookie!
      const loginReq = await new Promise<{ cookie: string }>((resolve, reject) => {
        const payload = JSON.stringify({ email, password: 'Password123!' });
        const req = http.request(
          {
            hostname: 'localhost',
            port: PORT,
            path: '/api/v1/auth/login',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            const cookies = res.headers['set-cookie'] || [];
            const sessionCookie = cookies.find((c) => c.startsWith('session_token='));
            resolve({ cookie: sessionCookie ? sessionCookie.split(';')[0] : '' });
          }
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      sessions.push(loginReq.cookie);
    }

    console.log('   ✓ 50 test user sessions ready.\n');

    // 3. Fire 50 concurrent JOIN requests simultaneously!
    console.log('[3] Firing 50 SIMULTANEOUS join requests against group...');
    const startTime = Date.now();

    const joinPromises = sessions.map((cookie) =>
      postRequest(`/api/v1/groups/${TARGET_GROUP_ID}/members`, cookie)
    );

    const results = await Promise.all(joinPromises);
    const duration = Date.now() - startTime;

    console.log(`   ✓ All 50 concurrent requests processed in ${duration}ms.\n`);

    // 4. Analyze Results
    let success201 = 0;
    let full400 = 0;
    let otherCount = 0;

    for (const r of results) {
      if (r.status === 201) success201++;
      else if (r.status === 400 && r.body?.error?.code === 'GROUP_FULL') full400++;
      else otherCount++;
    }

    console.log('========================================');
    console.log(' CONCURRENCY TEST RESULTS:');
    console.log(`   - 201 Success (Joined): ${success201}`);
    console.log(`   - 400 Rejected (Group Full): ${full400}`);
    if (otherCount > 0) console.log(`   - Other Responses: ${otherCount}`);

    // Check final count in Database
    const finalRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM group_memberships WHERE group_id = $1',
      [TARGET_GROUP_ID]
    );
    const finalCount = finalRes.rows[0].count;
    console.log(`\n FINAL DATABASE MEMBER COUNT: ${finalCount} / 10 MAX`);

    if (finalCount === 10 && success201 === (10 - initialCount) && full400 === (50 - success201)) {
      console.log(' SUCCESS: Concurrency management correctly locked the group!');
      console.log(' ZERO race conditions occurred. Member limit strictly enforced at 10.');
    } else {
      console.error(` ERROR: Expected exactly 10 members, but database has ${finalCount}`);
    }
    console.log('========================================\n');

  } catch (err) {
    console.error('Error during concurrency test:', err);
  } finally {
    server.close();
    await pool.end();
  }
}

main().catch(console.error);
