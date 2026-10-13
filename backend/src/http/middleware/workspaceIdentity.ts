import type { RequestHandler } from "express";

/**
 * This distribution intentionally has no inbound authentication. A stable
 * workspace identity keeps session and settings ownership deterministic.
 */
export const workspaceIdentity: RequestHandler = (req, _res, next) => {
  Object.assign(req, {
    user: {
      tenantId: "shared-workspace",
      objectId: "shared-user",
      subject: "shared-user",
      preferredUsername: "workspace@local",
      roles: [],
    },
  });
  next();
};
