process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server';
import db from '../src/db';

let server: http.Server;
const PORT = 4099;

function request(method: string, path: string, body?: any, cookie?: string, extraHeaders?: Record<string, string>): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:${PORT}` + path);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(extraHeaders || {}),
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

async function runAdminTests() {
  console.log('\n========================================');
  console.log('  STARTING /api/v1/admin/metrics SECURITY TESTS');
  console.log('========================================\n');

  server = app.listen(PORT);

  // 1. Unauthenticated request -> 401 Unauthorized
  console.log('1. Testing unauthenticated GET /api/v1/admin/metrics (should return 401)...');
  const unauthRes = await request('GET', '/api/v1/admin/metrics');
  if (unauthRes.status !== 401) {
    throw new Error(`Expected unauthenticated request to return 401, got ${unauthRes.status}`);
  }
  console.log('   ✓ Unauthenticated request blocked with 401 UNAUTHORIZED');

  // 2. Normal consumer user signup & login
  const normalEmail = `consumer.${Date.now()}@stanford.edu`;
  const signupRes = await request('POST', '/api/v1/auth/signup', {
    email: normalEmail,
    password: 'Password123!',
    full_name: 'Consumer Student',
  });
  const normalUserId = signupRes.body.data.user.id;

  const loginRes = await request('POST', '/api/v1/auth/login', {
    email: normalEmail,
    password: 'Password123!',
  });
  const setCookie = loginRes.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie || '';

  // 3. Normal consumer user attempt to access developer metrics -> 403 Forbidden
  console.log('2. Testing normal consumer GET /api/v1/admin/metrics (should return 403 Forbidden)...');
  const forbiddenRes = await request('GET', '/api/v1/admin/metrics', undefined, cookie);
  if (forbiddenRes.status !== 403) {
    throw new Error(`Expected consumer user request to return 403 Forbidden, got ${forbiddenRes.status}`);
  }
  console.log('   ✓ Normal consumer student blocked with 403 FORBIDDEN');

  // 4. Developer API Key access (X-Admin-Key header) -> 200 OK
  console.log('3. Testing platform developer access via X-Admin-Key header (should return 200 OK)...');
  const devKeyRes = await request('GET', '/api/v1/admin/metrics', undefined, undefined, { 'x-admin-key': 'dev_admin_secret' });
  if (devKeyRes.status !== 200) {
    throw new Error(`Expected X-Admin-Key request to return 200 OK, got ${devKeyRes.status}`);
  }
  console.log('   ✓ Developer API key authenticated successfully with 200 OK');

  // 5. System Administrator user flag (is_admin = true) -> 200 OK
  console.log('4. Testing platform admin account (is_admin = true) GET /api/v1/admin/metrics (should return 200 OK)...');
  await db.query('UPDATE users SET is_admin = TRUE WHERE id = $1', [normalUserId]);

  const adminMetricsRes = await request('GET', '/api/v1/admin/metrics', undefined, cookie);
  if (adminMetricsRes.status !== 200) {
    throw new Error(`Expected platform admin user request to return 200 OK, got ${adminMetricsRes.status}`);
  }
  const body = adminMetricsRes.body;
  console.log('   ✓ System admin user returned 200 OK with pure telemetry payload.');
  console.log(`     - System Status: ${body.data.system_status}`);
  console.log(`     - HTTP Total: ${body.data.http.total}`);
  console.log(`     - DB Query Count: ${body.data.database.total_queries}`);

  console.log('\n========================================');
  console.log('  ALL DEVELOPER ADMIN SECURITY TESTS PASSED');
  console.log('========================================\n');
  server.close();
  process.exit(0);
}

runAdminTests().catch((err) => {
  console.error('❌ Admin security test failed:', err);
  if (server) server.close();
  process.exit(1);
});
