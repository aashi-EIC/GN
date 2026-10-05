import axios from "axios";
import { storageKeys } from "../../../shared/config/storage";
import { bffClient } from "../../../shared/services/axios";
import type { McpRequestAudit, McpRequestPayload, Message } from "../../../shared/types/app";
import type { ModelId } from "../types/semantic";
import { createId } from "../../../shared/utils/session";
import { getBrowserUserId } from "../../../shared/utils/browserIdentity";
import { loadFromStorage, saveToStorage } from "../../../shared/utils/storage";

export function buildMcpRequestPayload({
  conversationId,
  mcpSessionId,
  modelId,
  prompt,
}: {
  conversationId: string;
  mcpSessionId?: string;
  modelId: ModelId;
  prompt: string;
}) {
  const sentAt = new Date().toISOString();
  const requestId = createId("mcp");
  const payload: McpRequestPayload = {
    browser_user_id: getBrowserUserId(),
    session_id: conversationId,
    ...(mcpSessionId ? { mcp_session_id: mcpSessionId } : {}),
    semantic_model_id: modelId,
    prompt,
    // Capture is independent of whether the debug panel is currently visible.
    debug: true,
  };
  const audit: McpRequestAudit = {
    ...payload,
    request_id: requestId,
    sent_at: sentAt,
  };

  return { payload, audit };
}

export async function requestMcpInsight(
  payload: McpRequestPayload,
  audit: McpRequestAudit,
): Promise<{
  answer: Omit<Message, "id" | "role" | "createdAt">;
  mcpSession?: McpSessionMetadata;
}> {
  // An analysis may still be running after a network failure. Retry only on user action.
  try {
    const response = await bffClient.post<ChatResponse>("/chat", payload);
    const answer = parseChatResponse(response.data);
    const mcpSession = readMcpSessionMetadata(response.data);

    return {
      answer: withMcpRuntime(
        {
          text: answer.text,
          backendId: response.data.message_id,
        },
        audit,
        response.data.request_id,
        response.data.debug,
      ),
      ...(mcpSession ? { mcpSession } : {}),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const upstreamMessage = readApiError(error.response?.data);
      if (upstreamMessage) throw new Error(upstreamMessage);
      if (error.code === "ECONNABORTED") {
        throw new Error("The analysis took too long. Please try again.");
      }
      if (!error.response) {
        throw new Error("The middleware is unavailable. Check that the BFF is running.");
      }
    }

    throw error;
  }
}

export function persistMcpRequestAudit(audit: McpRequestAudit) {
  const existing = loadFromStorage<McpRequestAudit[]>(storageKeys.mcpRequests, []);
  saveToStorage(storageKeys.mcpRequests, [audit, ...existing].slice(0, 50));
}

function withMcpRuntime(
  answer: Omit<Message, "id" | "role" | "createdAt">,
  audit: McpRequestAudit,
  correlationId?: string,
  runtimeDebug?: ChatResponse["debug"],
): Omit<Message, "id" | "role" | "createdAt"> {
  return {
    ...answer,
    debug: [
      {
        stage: "mcp_request_payload",
        status: "success",
        detail: "Request accepted by the middleware",
        payload: audit,
      },
      {
        stage: "mcp_response",
        status: "success",
        detail: correlationId
          ? `MCP response received (correlation ID: ${correlationId})`
          : "MCP response received",
        ...(runtimeDebug?.mcp_raw_response !== undefined
          ? { payload: runtimeDebug.mcp_raw_response }
          : {}),
      },
      ...(runtimeDebug?.generated_dax_queries !== undefined
        ? [
            {
              stage: "generated_dax_query",
              status: "success" as const,
              detail: runtimeDebug.generated_dax_queries.length
                ? `${runtimeDebug.generated_dax_queries.length} generated DAX ${runtimeDebug.generated_dax_queries.length === 1 ? "query" : "queries"}`
                : "No DAX query was needed for this response",
              payload: runtimeDebug.generated_dax_queries,
            },
          ]
        : []),
      {
        stage: "bff_response",
        status: "success",
        detail: "Response returned by the Node BFF",
        ...(runtimeDebug?.bff_response !== undefined ? { payload: runtimeDebug.bff_response } : {}),
      },
      {
        stage: "response_render",
        status: "success",
        detail: answer.visualizations?.length
          ? "Rendered structured response blocks"
          : "Rendered text response",
      },
    ],
  };
}

type ChatResponse = {
  answer?: {
    text?: unknown;
    blocks?: unknown;
  };
  message_id?: string;
  request_id?: string;
  mcp_session_id?: unknown;
  mcp_session?: unknown;
  debug?: {
    mcp_raw_response?: unknown;
    bff_response?: unknown;
    generated_dax_queries?: string[];
  };
};

export type McpSessionMetadata = {
  id?: string;
  messageCount?: number;
  status?: string;
  requiresNewSession: boolean;
};

function readMcpSessionMetadata(response: ChatResponse): McpSessionMetadata | undefined {
  const value = response.mcp_session;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const fallbackId = readBoundedString(response.mcp_session_id, 256);
    return fallbackId ? { id: fallbackId, requiresNewSession: false } : undefined;
  }
  const record = value as Record<string, unknown>;
  const id = readBoundedString(record.id, 256);
  const status = readBoundedString(record.status, 100);
  const messageCount =
    typeof record.message_count === "number" &&
    Number.isInteger(record.message_count) &&
    record.message_count >= 0
      ? record.message_count
      : undefined;
  const requiresNewSession = record.requires_new_session === true;
  if (!id && messageCount === undefined && !status && !requiresNewSession) return undefined;
  return {
    ...(id ? { id } : {}),
    ...(messageCount !== undefined ? { messageCount } : {}),
    ...(status ? { status } : {}),
    requiresNewSession,
  };
}

function readBoundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : undefined;
}

function parseChatResponse(response: ChatResponse) {
  if (!response.answer || typeof response.answer.text !== "string") {
    throw new Error("The middleware returned an unsupported response.");
  }

  return { text: response.answer.text };
}

function readApiError(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const error = "error" in value ? value.error : undefined;
  if (!error || typeof error !== "object") return undefined;
  const message = "message" in error ? error.message : undefined;
  return typeof message === "string" ? message : undefined;
}

export function formatUserFriendlyError(rawMessage: string): {
  userMessage: string;
  suggestion: string;
  statusLabel: string;
} {
  const normalized = rawMessage.toLowerCase();
  return (
    FRIENDLY_ERROR_RULES.find((rule) =>
      rule.matchingTerms.some((term) => normalized.includes(term)),
    )?.response ?? DEFAULT_FRIENDLY_ERROR
  );
}

type FriendlyError = {
  userMessage: string;
  suggestion: string;
  statusLabel: string;
};

const FRIENDLY_ERROR_RULES: Array<{ matchingTerms: string[]; response: FriendlyError }> = [
  {
    matchingTerms: ["mcp host returned an unsuccessful response", "upstream", "502", "503", "504"],
    response: {
      userMessage:
        "The backend analytics engine is currently experiencing a temporary pause or maintenance.",
      suggestion:
        "Please try submitting your question again in a few moments, or select a different semantic model.",
      statusLabel: "Service Pause",
    },
  },
  {
    matchingTerms: ["timeout", "took too long", "econnaborted"],
    response: {
      userMessage: "The analysis request took longer than expected to process.",
      suggestion:
        "Try narrowing your question to a specific metric or selecting a shorter time period.",
      statusLabel: "Request Timeout",
    },
  },
  {
    matchingTerms: ["middleware is unavailable", "bff is running", "network error"],
    response: {
      userMessage: "Unable to connect to the Conversational BI server.",
      suggestion:
        "Please check your network connection or verify that the server service is active.",
      statusLabel: "Connection Unavailable",
    },
  },
];

const DEFAULT_FRIENDLY_ERROR: FriendlyError = {
  userMessage: "We could not complete this analytical query at the moment.",
  suggestion: "Try rephrasing your prompt or picking another semantic model from the top bar.",
  statusLabel: "Notice",
};
