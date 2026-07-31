import { z } from 'zod';
import { config, requireConfig } from '../../config/env.js';
import { UpstreamError } from '../../errors.js';
import { assertSafeUnknown } from '../../security/contentSafety.js';
import type { NormalizedMcpResponse } from '../../types.js';

const externalRoot = z.record(z.string(), z.unknown());
const pathCache = new Map<string, string[]>();

function getPathParts(path: string) {
  const cached = pathCache.get(path);
  if (cached) return cached;

  const parts = path.split('.');
  pathCache.set(path, parts);
  return parts;
}

function getPath(root: Record<string, unknown>, path?: string): unknown {
  if (!path) return undefined;

  return getPathParts(path).reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return (value as Record<string, unknown>)[key];
  }, root);
}

export function adaptMcpResponse(input: unknown): NormalizedMcpResponse {
  requireConfig('MCP_RESPONSE_TEXT_PATH');

  const root = externalRoot.safeParse(input);
  if (!root.success) {
    throw new UpstreamError('MCP response must be a JSON object');
  }

  assertSafeUnknown(root.data);

  const answer = getPath(root.data, config.MCP_RESPONSE_TEXT_PATH);
  if (typeof answer !== 'string' || !answer.trim()) {
    throw new UpstreamError('MCP response does not contain valid text at the configured path');
  }

  const data = getPath(root.data, config.MCP_RESPONSE_DATA_PATH);
  const debug = getPath(root.data, config.MCP_RESPONSE_DEBUG_PATH);
  const visualization = getPath(root.data, config.MCP_RESPONSE_VISUALIZATION_PATH);

  if (debug !== undefined && !Array.isArray(debug)) {
    throw new UpstreamError('Configured MCP debug path must resolve to an array');
  }

  return {
    answer,
    ...(data !== undefined ? { data } : {}),
    ...(debug !== undefined ? { debug_events: debug } : {}),
    ...(visualization !== undefined ? { visualization } : {}),
  };
}
