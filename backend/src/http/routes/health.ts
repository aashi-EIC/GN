import { Router } from "express";
import { assertRuntimeConfiguration } from "../../config/env.js";

export const healthRouter = Router();

healthRouter.get("/live", (_req, res) => res.json({ status: "ok" }));

healthRouter.get("/ready", (_req, res) => {
  try {
    assertRuntimeConfiguration();
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});
