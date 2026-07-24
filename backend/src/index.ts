import { createServer } from 'node:http';
import { app } from './http/app.js';
import { closeRedis } from './infrastructure/cache/redis.js';
import { config } from './config/env.js';
import { closeDatabase } from './persistence/postgres/pool.js';
import { logger } from './observability/logger.js';

const server = createServer(app);
server.requestTimeout = config.MCP_TIMEOUT_MS + 5_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.listen(config.PORT, () => logger.info({ port: config.PORT }, 'BFF listening'));
async function shutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown started');
  server.close(async () => { await Promise.allSettled([closeDatabase(), closeRedis()]); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
