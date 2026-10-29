import type { RequestHandler } from "express";

// Shared pilot identity; access control belongs at the gateway.
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
