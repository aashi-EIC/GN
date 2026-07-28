import pg from 'pg';
import { config, requireConfig } from '../../config/env.js';

let pool: pg.Pool | undefined;
export function getPool(): pg.Pool {
  requireConfig('DATABASE_URL');
  pool ??= new pg.Pool({ connectionString: config.DATABASE_URL, ssl: config.DATABASE_SSL ? { rejectUnauthorized: true } : false, max: 10, idleTimeoutMillis: 30_000 });
  return pool;
}
export async function checkDatabase() { const result = await getPool().query('select 1 as ok'); return result.rows[0]?.ok === 1; }
export async function closeDatabase() { await pool?.end(); }
