import { setTimeout as delay } from "node:timers/promises";
import { config, getRequired } from "../../config/env.js";
import { ConfigurationError, UpstreamError } from "../../errors.js";
import { logger } from "../../observability/logger.js";
import type { AuthenticatedUser } from "../../types.js";
import type { OutboundAuthenticationProvider } from "./authenticationProvider.js";

const RETRYABLE_STATUSES = new Set([500, 502, 503, 504, 429]);

export class HttpMcpHostClient {
  constructor(private readonly authentication: OutboundAuthenticationProvider) {}

  async send(
    body: unknown,
    user: AuthenticatedUser,
    correlationId: string,
    callerSignal: AbortSignal,
  ): Promise<unknown> {
    const url = getMcpUrl();
    const authHeaders = await this.authentication.getHeaders(user, callerSignal);
    const attempts = config.MCP_SAFE_RETRY_ENABLED ? config.MCP_MAX_RETRIES + 1 : 1;

    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await this.postJson(url, body, authHeaders, correlationId, callerSignal);

        if (!response.ok) {
          await this.handleUnsuccessfulResponse(response, attempt, attempts, callerSignal);
        } else {
          return await readJsonResponse(response);
        }
      } catch (error) {
        lastError = error;

        if (callerSignal.aborted) {
          throw new UpstreamError("Request was cancelled", undefined, 499);
        }

        if (error instanceof UpstreamError) {
          throw error;
        }

        if (attempt < attempts) {
          logger.warn({ correlationId, attempt, err: error }, "Retrying MCP request");
          await delay(backoff(attempt), undefined, { signal: callerSignal });
          continue;
        }
      }
    }

    throw new UpstreamError(
      "MCP host request failed",
      lastError instanceof Error ? { name: lastError.name } : undefined,
      504,
    );
  }

  private async postJson(
    url: URL,
    body: unknown,
    authHeaders: Record<string, string>,
    correlationId: string,
    callerSignal: AbortSignal,
  ) {
    const timeoutSignal = AbortSignal.timeout(config.MCP_TIMEOUT_MS);
    const signal = AbortSignal.any([callerSignal, timeoutSignal]);

    return fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-correlation-id": correlationId,
        ...authHeaders,
      },
      body: JSON.stringify(body),
      signal,
    });
  }

  private async handleUnsuccessfulResponse(
    response: Response,
    attempt: number,
    attempts: number,
    callerSignal: AbortSignal,
  ) {
    if (RETRYABLE_STATUSES.has(response.status) && attempt < attempts) {
      await delay(backoff(attempt), undefined, { signal: callerSignal });
      return;
    }

    throw new UpstreamError("MCP host returned an unsuccessful response", {
      upstreamStatus: response.status,
    });
  }
}

let cachedMcpUrl: URL | undefined;

function getMcpUrl() {
  if (!cachedMcpUrl) {
    const baseUrl = new URL(getRequired("MCP_BASE_URL"));
    const endpointUrl = new URL(getRequired("MCP_ENDPOINT_PATH"), baseUrl);

    if (endpointUrl.origin !== baseUrl.origin) {
      throw new ConfigurationError("MCP_ENDPOINT_PATH must remain on MCP_BASE_URL origin");
    }
    cachedMcpUrl = endpointUrl;
  }

  return cachedMcpUrl;
}

const jsonDecoder = new TextDecoder();

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new UpstreamError("MCP host returned a non-JSON response");
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > config.MCP_MAX_RESPONSE_BYTES) {
    throw new UpstreamError("MCP response exceeded the configured size limit");
  }

  if (!response.body) {
    throw new UpstreamError("MCP host returned an empty response");
  }

  const bytes = await readLimitedBody(response.body);

  try {
    return JSON.parse(jsonDecoder.decode(bytes));
  } catch {
    throw new UpstreamError("MCP host returned invalid JSON");
  }
}

async function readLimitedBody(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > config.MCP_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new UpstreamError("MCP response exceeded the configured size limit");
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

function backoff(attempt: number) {
  return Math.min(250 * 2 ** (attempt - 1) + Math.random() * 100, 1500);
}
