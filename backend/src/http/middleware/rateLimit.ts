import type { RequestHandler } from "express";
import { config } from "../../config/env.js";
import { AppError } from "../../errors.js";
import { getRedis } from "../../infrastructure/cache/redis.js";
import type { AuthenticatedRequest } from "../../types.js";

const memory = new Map<string, { count: number; reset: number }>();

export const rateLimit: RequestHandler = async (request, res, next) => {
  try {
    const req = request as AuthenticatedRequest;
    const now = Date.now();
    const key = getRateLimitKey(req, now);
    const count = await incrementCounter(key, now);

    res.setHeader("x-ratelimit-limit", config.RATE_LIMIT_MAX);
    res.setHeader("x-ratelimit-remaining", Math.max(0, config.RATE_LIMIT_MAX - count));

    if (count > config.RATE_LIMIT_MAX) {
      res.setHeader("retry-after", Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000));
      throw new AppError(429, "RATE_LIMITED", "Too many requests");
    }

    next();
  } catch (error) {
    next(error);
  }
};

function getRateLimitKey(req: Partial<AuthenticatedRequest>, now: number) {
  const bucket = Math.floor(now / config.RATE_LIMIT_WINDOW_MS);
  const userKey = req.user ? `${req.user.tenantId}:${req.user.objectId}` : req.ip || "anonymous";
  return `bff:rate:${userKey}:${bucket}`;
}

async function incrementCounter(key: string, now: number) {
  const redis = await getRedis();

  if (redis) {
    const pipeline = redis.multi();
    pipeline.incr(key);
    pipeline.pExpire(key, config.RATE_LIMIT_WINDOW_MS, "NX");
    const results = await pipeline.exec();
    return (results?.[0] as unknown as number) ?? 1;
  }

  return incrementMemoryCounter(key, now);
}

let lastCleanup = 0;

function incrementMemoryCounter(key: string, now: number) {
  const current = memory.get(key);

  if (!current || current.reset <= now) {
    memory.set(key, { count: 1, reset: now + config.RATE_LIMIT_WINDOW_MS });
    maybeCleanExpiredMemoryBuckets(now);
    return 1;
  }

  current.count += 1;
  maybeCleanExpiredMemoryBuckets(now);

  return current.count;
}

function maybeCleanExpiredMemoryBuckets(now: number) {
  if (memory.size <= 10_000 || now - lastCleanup < 60_000) return;
  lastCleanup = now;

  for (const [key, value] of memory) {
    if (value.reset <= now) {
      memory.delete(key);
    }
  }
}
