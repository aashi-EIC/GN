import type { RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config, getRequired } from "../../config/env.js";
import { AuthenticationError, AuthorizationError } from "../../errors.js";
import { logger } from "../../observability/logger.js";

let cachedJwks: { tenant: string; jwks: ReturnType<typeof createRemoteJWKSet> } | undefined;

export const authenticate: RequestHandler = async (req, _res, next) => {
  if (config.DISABLE_AUTH) {
    Object.assign(req, {
      user: {
        tenantId: config.ENTRA_TENANT_ID || "dev-tenant",
        objectId: "dev-user-id",
        subject: "dev-subject",
        preferredUsername: "devuser@local",
        scopes: config.ENTRA_REQUIRED_SCOPE ? [config.ENTRA_REQUIRED_SCOPE] : ["access_as_user"],
        roles: [],
        rawAccessToken: "dev-token",
      },
    });
    next();
    return;
  }

  try {
    const tenantId = getRequired("ENTRA_TENANT_ID");
    const audience = getRequired("ENTRA_API_AUDIENCE");
    const token = readBearerToken(req.header("authorization"));
    const jwks = getJwks(tenantId);
    const issuer = config.ENTRA_ACCEPT_V1_TOKENS
      ? [
          `https://login.microsoftonline.com/${tenantId}/v2.0`,
          `https://sts.windows.net/${tenantId}/`,
        ]
      : `https://login.microsoftonline.com/${tenantId}/v2.0`;

    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      algorithms: ["RS256"],
      clockTolerance: "5m",
    });

    const scopes = readScopes(payload);
    const roles = readStringArray(payload.roles);

    enforceScope(scopes);
    enforceRoles(roles);

    Object.assign(req, {
      user: {
        tenantId: requiredClaim(payload, "tid"),
        objectId: requiredClaim(payload, "oid"),
        subject: requiredClaim(payload, "sub"),
        ...(typeof payload.preferred_username === "string"
          ? { preferredUsername: payload.preferred_username }
          : {}),
        scopes,
        roles,
        rawAccessToken: token,
      },
    });

    next();
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      next(error);
      return;
    }

    logger.warn({ err: error }, "JWT verification failed");
    next(new AuthenticationError("Invalid or expired access token"));
  }
};

function readBearerToken(header?: string) {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  if (!match?.[1]) throw new AuthenticationError();

  return match[1];
}

function getJwks(tenantId: string) {
  if (!cachedJwks || cachedJwks.tenant !== tenantId) {
    cachedJwks = {
      tenant: tenantId,
      jwks: createRemoteJWKSet(
        new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`),
      ),
    };
  }

  return cachedJwks.jwks;
}

function requiredClaim(payload: JWTPayload, name: string) {
  const value = payload[name];
  if (typeof value !== "string" || !value) {
    throw new AuthenticationError(`Required token claim is missing: ${name}`);
  }

  return value;
}

function readScopes(payload: JWTPayload) {
  return typeof payload.scp === "string" ? payload.scp.split(" ").filter(Boolean) : [];
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function enforceScope(scopes: string[]) {
  if (config.ENTRA_REQUIRED_SCOPE && !scopes.includes(config.ENTRA_REQUIRED_SCOPE)) {
    throw new AuthorizationError("Required delegated scope is missing");
  }
}

function enforceRoles(roles: string[]) {
  const allowedRoles =
    config.ENTRA_ALLOWED_ROLES?.split(",")
      .map((role) => role.trim())
      .filter(Boolean) ?? [];

  if (allowedRoles.length && !roles.some((role) => allowedRoles.includes(role))) {
    throw new AuthorizationError("Required application role is missing");
  }
}
