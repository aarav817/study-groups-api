import { Pool, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
          ? false
          : { rejectUnauthorized: false },
      }
    : {
        host: process.env.PGHOST || '/run/postgresql',
        port: parseInt(process.env.PGPORT || '5432', 10),
        database: process.env.PGDATABASE || 'study_groups',
        user: process.env.PGUSER || undefined,
        ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
      }
);

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

let metricsCollectorModule: any = null;

export const query = async <R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> => {
  const start = performance.now();
  try {
    const res = params ? await pool.query<R>(text, params) : await pool.query<R>(text);
    return res;
  } finally {
    const durationMs = performance.now() - start;
    try {
      if (!metricsCollectorModule) {
        metricsCollectorModule = require('./utils/metrics').metricsCollector;
      }
      if (metricsCollectorModule) {
        metricsCollectorModule.recordDbQuery(durationMs);
      }
    } catch (e) {
      // Ignore metric logging error
    }
  }
};

// Ensure database schema migrations for email verification features
(async () => {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);

      CREATE TABLE IF NOT EXISTS group_conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
        title VARCHAR(150) NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, title)
      );

      ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES group_conversations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_group_messages_conversation ON group_messages(conversation_id);
    `);
  } catch (err) {
    // Ignore migration error if DB connecting later or test environment
  }
})();

export default {
  query,
  pool,
};
