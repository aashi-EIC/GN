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
  sessionId: string;
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
          mcp_raw_response: redactSensitiveValues(external),
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
