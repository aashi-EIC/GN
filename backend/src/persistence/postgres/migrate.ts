import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getPool, closeDatabase } from './pool.js';

const migrationsDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));
try {
  const migrations = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const migration of migrations) {
    await getPool().query(await readFile(`${migrationsDirectory}/${migration}`, 'utf8'));
  }
  process.stdout.write('Database migration completed.\n');
} finally {
  await closeDatabase();
}
