import { createAuthenticationProvider } from "../../integrations/mcp/authenticationProvider.js";
import { HttpMcpHostClient } from "../../integrations/mcp/httpMcpHostClient.js";
import { adaptMcpRequest } from "../../integrations/mcp/mcpRequestAdapter.js";
import { adaptMcpResponse } from "../../integrations/mcp/mcpResponseAdapter.js";
import {
  ensureOwnedSession,
  saveAssistantMessage,
} from "../../persistence/repositories/sessionRepository.js";
import { assertSafeText } from "../../security/contentSafety.js";
import type { AuthenticatedUser } from "../../types.js";

const client = new HttpMcpHostClient(createAuthenticationProvider());

type ChatInput = {
  prompt: string;
  browserUserId: string;
  sessionId: string;
  mcpSessionId?: string;
  semanticModelId: string;
  correlationId: string;
  user: AuthenticatedUser;
  signal: AbortSignal;
  includeDebug?: boolean;
};

export async function processChat(input: ChatInput) {
  assertSafeText(input.prompt, "Prompt");

  const userMessageId = await ensureOwnedSession({
    id: input.sessionId,
    semanticModelId: input.semanticModelId,
    prompt: input.prompt,
    user: input.user,
    correlationId: input.correlationId,
  });

  const external = await client.send(
    adaptMcpRequest(input),
    input.user,
    input.correlationId,
    input.signal,
  );
  const normalized = adaptMcpResponse(external);

  const messageId = await saveAssistantMessage(input.sessionId, input.correlationId, normalized);

  const response = {
    ...normalized,
    message_id: messageId,
    user_message_id: userMessageId,
  };

  return input.includeDebug
    ? {
        ...response,
        debug: {
          mcp_raw_response: normalizeRawDaxQuery(redactSensitiveValues(external)),
          ...(normalized.generated_dax_queries
            ? { generated_dax_queries: normalized.generated_dax_queries }
            : {}),
        },
      }
    : response;
}

function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveValues);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /authorization|cookie|token|secret|api[-_]?key/i.test(key)
        ? "[REDACTED]"
        : redactSensitiveValues(entry),
    ]),
  );
}

/**
 * Normalises the `generated_dax_query` field on the raw MCP response before it
 * is forwarded to the frontend debug view.  The MCP server occasionally returns
 * the query as a bare string (Pydantic coercion produces a character array when
 * the model annotates the field as `List[str]` and receives a `str`).  We
 * reconstruct the full query string so the debug drawer remains readable.
 */
function normalizeRawDaxQuery(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const record = value as Record<string, unknown>;
  const raw = record["generated_dax_query"];

  if (typeof raw === "string") {
    return { ...record, generated_dax_query: [raw] };
  }

  if (Array.isArray(raw)) {
    const isCharArray =
      raw.length > 1 && raw.every((item) => typeof item === "string" && item.length <= 1);
    if (isCharArray) {
      const joined = (raw as string[]).join("").trim();
      return { ...record, generated_dax_query: joined ? [joined] : [] };
    }
  }

  return value;
}