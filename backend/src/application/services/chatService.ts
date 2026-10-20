import { createAuthenticationProvider } from "../../integrations/mcp/authenticationProvider.js";
import { HttpMcpHostClient } from "../../integrations/mcp/httpMcpHostClient.js";
import {
  HttpMcpStreamClient,
  type StreamProgressHandler,
} from "../../integrations/mcp/httpMcpStreamClient.js";
import { adaptMcpRequest } from "../../integrations/mcp/mcpRequestAdapter.js";
import { adaptMcpResponse } from "../../integrations/mcp/mcpResponseAdapter.js";
import { normalizeGeneratedDaxField } from "../../integrations/mcp/daxQueryNormalizer.js";
import { readDebugTokenUsage, readTokenUsage } from "../../integrations/mcp/tokenUsage.js";
import {
  ensureOwnedSession,
  saveAssistantMessage,
} from "../../persistence/repositories/sessionRepository.js";
import { assertSafeText } from "../../security/contentSafety.js";
import type { AuthenticatedUser, McpHostResponse } from "../../types.js";
import { ConfigurationError } from "../../errors.js";
import { beginMonthlyRequest, settleMonthlyRequest } from "./monthlyTokenQuota.js";

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
  input.signal.throwIfAborted();
  const ticket = beginMonthlyRequest(input.browserUserId);
  let submitted = false;
  let settled = false;
  let reportedUsage: McpHostResponse["token_usage"];
  try {
    const userMessageId = await ensureOwnedSession({
      id: input.sessionId,
      semanticModelId: input.semanticModelId,
      prompt: input.prompt,
      user: input.user,
      correlationId: input.correlationId,
    });

    input.signal.throwIfAborted();
    submitted = true;
    const external = onStreamProgress
      ? await streamClient.send(input, input.signal, onStreamProgress)
      : await client.send(adaptMcpRequest(input), input.user, input.correlationId, input.signal);
    reportedUsage = readTokenUsage(
      external && typeof external === "object" && "token_usage" in external
        ? external.token_usage
        : undefined,
    );
    // Account before rendering or cancellation checks; an upstream call may already be billed.
    settleMonthlyRequest(ticket, reportedUsage, submitted);
    settled = true;
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
  } catch (error) {
    if (!settled) {
      settleMonthlyRequest(
        ticket,
        reportedUsage,
        submitted && !(error instanceof ConfigurationError),
      );
    }
    throw error;
  }
}

function redactSensitiveValues(value: unknown, key = ""): unknown {
  // Usage fields are explicitly allowlisted; credentials and arbitrary metadata stay hidden.
  if (key === "token_usage") return readDebugTokenUsage(value) ?? "[REDACTED]";
  if (/authorization|bearer|cookie|token|secret|password|passwd|api[-_]?key/i.test(key)) {
    return "[REDACTED]";
  }
  if (Array.isArray(value)) return value.map((entry) => redactSensitiveValues(entry));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, redactSensitiveValues(entry, key)]),
  );
}
