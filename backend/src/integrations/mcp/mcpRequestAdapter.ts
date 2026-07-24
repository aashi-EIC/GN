import { config, getRequired } from '../../config/env.js';
import { ConfigurationError } from '../../errors.js';
import type { McpRequestContext } from '../../types.js';

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.');
  if (!parts.length || parts.some((part) => !part || forbidden.has(part))) throw new ConfigurationError(`Invalid MCP request field path: ${path}`);
  let current = target;
  for (const part of parts.slice(0, -1)) {
    const existing = current[part];
    if (existing !== undefined && (!existing || typeof existing !== 'object' || Array.isArray(existing))) throw new ConfigurationError(`Conflicting MCP request field path: ${path}`);
    const next = (existing ?? {}) as Record<string, unknown>; current[part] = next; current = next;
  }
  current[parts.at(-1)!] = value;
}

/**
 * This is the only place that maps the stable BFF contract to the unknown client MCP payload.
 * Field names are deliberately supplied by environment variables until the client contract arrives.
 */
export function adaptMcpRequest(context: McpRequestContext): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  setPath(body, getRequired('MCP_REQUEST_PROMPT_FIELD'), context.prompt);
  setPath(body, getRequired('MCP_REQUEST_SESSION_FIELD'), context.sessionId);
  setPath(body, getRequired('MCP_REQUEST_MODEL_FIELD'), context.semanticModelId);
  if (config.MCP_REQUEST_CORRELATION_FIELD) setPath(body, config.MCP_REQUEST_CORRELATION_FIELD, context.correlationId);
  if (config.MCP_REQUEST_USER_FIELD) {
    if (!config.MCP_REQUEST_USER_VALUE_SOURCE) throw new ConfigurationError('MCP_REQUEST_USER_VALUE_SOURCE is not configured');
    const userValue = config.MCP_REQUEST_USER_VALUE_SOURCE === 'oid' ? context.user.objectId
      : config.MCP_REQUEST_USER_VALUE_SOURCE === 'sub' ? context.user.subject : context.user.preferredUsername;
    if (!userValue) throw new ConfigurationError(`The configured user claim ${config.MCP_REQUEST_USER_VALUE_SOURCE} is absent`);
    setPath(body, config.MCP_REQUEST_USER_FIELD, userValue);
  }
  return body;
}
