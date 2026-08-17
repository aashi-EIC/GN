import { createClient, type RedisClientType } from "redis";
import { config } from "../../config/env.js";
import { logger } from "../../observability/logger.js";

let client: RedisClientType | undefined;
export async function getRedis(): Promise<RedisClientType | undefined> {
  if (!config.REDIS_URL) return undefined;
  if (!client) {
    client = createClient({ url: config.REDIS_URL });
    client.on("error", (error) => logger.error({ err: error }, "Redis error"));
    await client.connect();
  }
  return client;
}
export async function checkRedis() {
  const redis = await getRedis();
  return redis ? (await redis.ping()) === "PONG" : undefined;
}
export async function closeRedis() {
  if (client?.isOpen) await client.quit();
}
