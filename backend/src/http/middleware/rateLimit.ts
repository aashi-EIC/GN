import type { Request, RequestHandler } from "express";
import { config } from "../../config/env.js";
import { AppError } from "../../errors.js";

const memory = new Map<string, { count: number; reset: number }>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const rateLimit: RequestHandler = async (request, res, next) => {
  try {
    const now = Date.now();
    const key = getRateLimitKey(request, now);
    const count = incrementMemoryCounter(key, now);

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

function getRateLimitKey(req: Request, now: number) {
  const bucket = Math.floor(now / config.RATE_LIMIT_WINDOW_MS);
  const suppliedBrowserId = req.get("x-browser-user-id")?.trim();
  const identity =
    suppliedBrowserId && uuidPattern.test(suppliedBrowserId)
      ? `browser:${suppliedBrowserId.toLowerCase()}`
      : `ip:${req.ip || "anonymous"}`;
  return `bff:rate:${identity}:${bucket}`;
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
