import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getPool, closeDatabase } from './pool.js';

const migration = fileURLToPath(new URL('./migrations/001_init.sql', import.meta.url));
try {
  await getPool().query(await readFile(migration, 'utf8'));
  process.stdout.write('Database migration completed.\n');
} finally { await closeDatabase(); }
