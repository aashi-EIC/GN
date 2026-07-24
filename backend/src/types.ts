import type { Request } from 'express';

export type AuthenticatedUser = {
  tenantId: string;
  objectId: string;
  subject: string;
  preferredUsername?: string;
  scopes: string[];
  roles: string[];
  rawAccessToken: string;
};

export type AuthenticatedRequest = Request & { user: AuthenticatedUser; correlationId: string; requestSignal: AbortSignal };

export type McpRequestContext = {
  prompt: string;
  sessionId: string;
  semanticModelId: string;
  correlationId: string;
  user: AuthenticatedUser;
};

export type NormalizedMcpResponse = {
  answer: string;
  data?: unknown;
  debug_events?: unknown[];
  visualization?: unknown;
};
