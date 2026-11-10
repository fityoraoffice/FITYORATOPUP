import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

const globalForPg = globalThis as typeof globalThis & { __cahyoPgPool?: Pool };

/**
 * Supabase Transaction Pooler connection for Vercel/serverless.
 * DATABASE_URL must be configured as a server-only Secret in Vercel.
 */
export function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum dikonfigurasi. Tambahkan sebagai Environment Variable Secret di Vercel.');
  }

  if (!globalForPg.__cahyoPgPool) {
    globalForPg.__cahyoPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase requires TLS. If DATABASE_SSL_CA (PEM from Supabase > Database > SSL) is set, the
      // server certificate is verified; otherwise the previous encrypted-but-unverified mode is kept.
      ssl: process.env.DATABASE_SSL_CA
        ? { ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true }
        : { rejectUnauthorized: false },
      // Keep per-instance connection usage low on Vercel.
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });

    globalForPg.__cahyoPgPool.on('error', (error) => {
      console.error('[PostgreSQL] Unexpected idle client error:', error);
    });
  }

  return globalForPg.__cahyoPgPool;
}

export const pool = createPool();
export const db = drizzle(pool, { schema });

export async function checkDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('select 1');
  } finally {
    client.release();
  }
}
