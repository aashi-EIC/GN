import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { config } from '../../config/env.js';
import { AppError } from '../../errors.js';
import { getRedis } from '../../infrastructure/cache/redis.js';
import type { AuthenticatedRequest } from '../../types.js';

const memory = new Map<string, { count: number; reset: number }>();

export const rateLimit: RequestHandler = async (request, res, next) => {
  try {
    const req = request as AuthenticatedRequest;
    const now = Date.now();
    const key = getRateLimitKey(req, now);
    const count = await incrementCounter(key, now);

    res.setHeader('x-ratelimit-limit', config.RATE_LIMIT_MAX);
    res.setHeader('x-ratelimit-remaining', Math.max(0, config.RATE_LIMIT_MAX - count));

    if (count > config.RATE_LIMIT_MAX) {
      res.setHeader('retry-after', Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000));
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests');
    }

    next();
  } catch (error) {
    next(error);
  }
};

function getRateLimitKey(req: Partial<AuthenticatedRequest>, now: number) {
  const bucket = Math.floor(now / config.RATE_LIMIT_WINDOW_MS);
  const userKey = req.user ? `${req.user.tenantId}:${req.user.objectId}` : (req.ip || 'anonymous');
  const identity = createHash('sha256')
    .update(userKey)
    .digest('hex');

  return `bff:rate:${identity}:${bucket}`;
}

async function incrementCounter(key: string, now: number) {
  const redis = await getRedis();

  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pExpire(key, config.RATE_LIMIT_WINDOW_MS);
    }

    return count;
  }

  return incrementMemoryCounter(key, now);
}

function incrementMemoryCounter(key: string, now: number) {
  const current = memory.get(key);

  if (!current || current.reset <= now) {
    memory.set(key, { count: 1, reset: now + config.RATE_LIMIT_WINDOW_MS });
    cleanExpiredMemoryBuckets(now);
    return 1;
  }

  current.count += 1;
  cleanExpiredMemoryBuckets(now);

  return current.count;
}

function cleanExpiredMemoryBuckets(now: number) {
  if (memory.size <= 10_000) return;

  for (const [key, value] of memory) {
    if (value.reset <= now) {
      memory.delete(key);
    }
  }
}
