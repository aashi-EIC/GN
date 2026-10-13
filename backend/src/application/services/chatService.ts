import { createAuthenticationProvider } from "../../integrations/mcp/authenticationProvider.js";
import { HttpMcpHostClient } from "../../integrations/mcp/httpMcpHostClient.js";
import {
  HttpMcpStreamClient,
  type StreamProgressHandler,
} from "../../integrations/mcp/httpMcpStreamClient.js";
import { adaptMcpRequest } from "../../integrations/mcp/mcpRequestAdapter.js";
import { adaptMcpResponse } from "../../integrations/mcp/mcpResponseAdapter.js";
import { normalizeGeneratedDaxField } from "../../integrations/mcp/daxQueryNormalizer.js";
import {
  ensureOwnedSession,
  saveAssistantMessage,
} from "../../persistence/repositories/sessionRepository.js";
import { assertSafeText } from "../../security/contentSafety.js";
import type { AuthenticatedUser } from "../../types.js";

const client = new HttpMcpHostClient(createAuthenticationProvider());
const streamClient = new HttpMcpStreamClient(createAuthenticationProvider());

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

export async function processChat(input: ChatInput, onStreamProgress?: StreamProgressHandler) {
  assertSafeText(input.prompt, "Prompt");

  const userMessageId = await ensureOwnedSession({
    id: input.sessionId,
    semanticModelId: input.semanticModelId,
    prompt: input.prompt,
    user: input.user,
    correlationId: input.correlationId,
  });

  const external = onStreamProgress
    ? await streamClient.send(input, input.signal, onStreamProgress)
    : await client.send(adaptMcpRequest(input), input.user, input.correlationId, input.signal);
  const normalized = adaptMcpResponse(external);
  input.signal.throwIfAborted();

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
          mcp_raw_response: normalizeGeneratedDaxField(redactSensitiveValues(external)),
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
