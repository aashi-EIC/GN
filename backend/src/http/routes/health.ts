import { Router } from "express";
import { checkRedis } from "../../infrastructure/cache/redis.js";
import { assertRuntimeConfiguration } from "../../config/env.js";

export const healthRouter = Router();

healthRouter.get("/live", (_req, res) => res.json({ status: "ok" }));

healthRouter.get("/ready", async (_req, res) => {
  try {
    assertRuntimeConfiguration();
    const redis = await checkRedis();

    res.json({
      status: "ready",
      dependencies: {
        ...(redis === undefined ? {} : { redis }),
      },
    });
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});
