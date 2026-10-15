import type { RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../../config/env.js";
import { logger } from "../../observability/logger.js";
import type { AuthenticatedUser } from "../../types.js";

const DEFAULT_DEV_USER: AuthenticatedUser = {
  tenantId: "shared-workspace",
  objectId: "shared-user",
  subject: "shared-user",
  preferredUsername: "workspace@local",
  roles: [],
};

// Remote JWKS cache for Microsoft Entra ID
let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedTenantId: string | undefined = undefined;

function getJWKS(tenantId?: string) {
  const effectiveTenant = tenantId || config.ENTRA_TENANT_ID || "common";
  if (!cachedJWKS || cachedTenantId !== effectiveTenant) {
    const jwksUri = new URL(`https://login.microsoftonline.com/${effectiveTenant}/discovery/v2.0/keys`);
    cachedJWKS = createRemoteJWKSet(jwksUri, {
      cooldownDuration: 30_000,
      cacheMaxAge: 600_000,
    });
    cachedTenantId = effectiveTenant;
  }
  return cachedJWKS;
}

export const entraAuth: RequestHandler = async (req, res, next) => {
  const isAuthEnforced = !config.DISABLE_AUTH || config.ENTRA_AUTH_ENABLED;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (!isAuthEnforced) {
      Object.assign(req, { user: DEFAULT_DEV_USER });
      return next();
    }
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authorization header with Bearer token is required.",
      },
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    if (!isAuthEnforced) {
      Object.assign(req, { user: DEFAULT_DEV_USER });
      return next();
    }
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Bearer token is empty.",
      },
    });
    return;
  }

  try {
    const tenantId = config.ENTRA_TENANT_ID;
    const jwks = getJWKS(tenantId);

    // Prepare acceptable issuers
    const expectedIssuers: string[] = [];
    if (tenantId && tenantId !== "common") {
      expectedIssuers.push(`https://login.microsoftonline.com/${tenantId}/v2.0`);
      if (config.ENTRA_ACCEPT_V1_TOKENS) {
        expectedIssuers.push(`https://sts.windows.net/${tenantId}/`);
      }
    }

    // Prepare acceptable audience
    const audienceCandidates = [
      config.ENTRA_API_AUDIENCE,
      config.ENTRA_CLIENT_ID,
    ].filter((val): val is string => Boolean(val && val.trim()));

    const verificationOptions: Parameters<typeof jwtVerify>[2] = {};
    if (expectedIssuers.length > 0) {
      verificationOptions.issuer = expectedIssuers;
    }
    if (audienceCandidates.length > 0) {
      verificationOptions.audience = audienceCandidates;
    }

    const { payload } = await jwtVerify(token, jwks, verificationOptions);

    // Extract claims
    const objectId = (payload.oid || payload.sub || "unknown-user") as string;
    const userTenantId = (payload.tid as string) || tenantId || "unknown-tenant";
    const subject = (payload.sub as string) || objectId;
    const preferredUsername = (
      payload.preferred_username ||
      payload.upn ||
      payload.email ||
      payload.unique_name
    ) as string | undefined;

    // Roles extraction
    const rawRoles = payload.roles;
    const roles: string[] = Array.isArray(rawRoles)
      ? (rawRoles as string[])
      : typeof rawRoles === "string"
        ? [rawRoles]
        : [];

    // Check allowed roles if configured
    if (config.ENTRA_ALLOWED_ROLES) {
      const allowedRoles = config.ENTRA_ALLOWED_ROLES.split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      const hasRole = roles.some((r) => allowedRoles.includes(r));
      if (!hasRole && allowedRoles.length > 0) {
        logger.warn({ roles, allowedRoles, user: preferredUsername }, "User missing required Entra role");
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Insufficient role permissions for this resource.",
          },
        });
        return;
      }
    }

    // Check required scope if configured
    if (config.ENTRA_REQUIRED_SCOPE) {
      const rawScopes = (payload.scp as string) || "";
      const scopes = rawScopes.split(" ").filter(Boolean);
      if (!scopes.includes(config.ENTRA_REQUIRED_SCOPE)) {
        logger.warn({ scopes, requiredScope: config.ENTRA_REQUIRED_SCOPE }, "Token missing required scope");
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: `Missing required scope: ${config.ENTRA_REQUIRED_SCOPE}`,
          },
        });
        return;
      }
    }

    const authenticatedUser: AuthenticatedUser = {
      tenantId: userTenantId,
      objectId,
      subject,
      roles,
      rawAccessToken: token,
      ...(preferredUsername ? { preferredUsername } : {}),
    };

    Object.assign(req, { user: authenticatedUser });
    return next();
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Token validation failed";
    logger.warn({ error: errMessage }, "Entra ID JWT verification failed");

    if (!isAuthEnforced) {
      // In dev mode when auth is not strictly enforced, log warning but allow request to continue with dev identity
      logger.info("Auth not strictly enforced, falling back to local workspace identity");
      Object.assign(req, { user: DEFAULT_DEV_USER });
      return next();
    }

    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: `Invalid authentication token: ${errMessage}`,
      },
    });
  }
};
