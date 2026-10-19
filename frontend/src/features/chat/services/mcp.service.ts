import axios from "axios";
import { env } from "../../../shared/config/env";
import type { StreamCallbacks } from "./chatStream";
import { storageKeys } from "../../../shared/config/storage";
import { bffClient } from "../../../shared/services/axios";
import type {
  ChatTransportMode,
  McpRequestAudit,
  McpRequestPayload,
  Message,
} from "../../../shared/types/app";
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
  streamCallbacks: StreamCallbacks = {},
  mode: ChatTransportMode = "auto",
): Promise<{
  answer: Omit<Message, "id" | "role" | "createdAt">;
  mcpSession?: McpSessionMetadata;
}> {
  try {
    if (mode === "streaming" && !env.chatStreamingEnabled) {
      throw new Error("Streaming is disabled for this deployment.");
    }
    const streaming =
      mode !== "standard" && env.chatStreamingEnabled ? await import("./chatStream") : undefined;
    const canStream = streaming ? await streaming.isChatStreamingAvailable() : false;
    if (mode === "streaming" && !canStream) {
      throw new Error("Streaming is unavailable for this deployment.");
    }
    const response =
      streaming && canStream
        ? { data: await streaming.requestStreamingChat(payload, streamCallbacks) }
        : await bffClient.post<ChatResponse>("/chat", payload);
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
  const audits = Array.isArray(existing) ? existing : [];
  saveToStorage(storageKeys.mcpRequests, [audit, ...audits].slice(0, 50));
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

export type ChatResponse = {
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
  debugDetail: string;
} {
  const normalized = rawMessage.toLowerCase();
  const matched = FRIENDLY_ERROR_RULES.find((rule) =>
    rule.matchingTerms.some((term) => normalized.includes(term)),
  )?.response;

  if (matched) return matched;

  return {
    ...DEFAULT_FRIENDLY_ERROR,
    debugDetail: rawMessage.trim() || DEFAULT_FRIENDLY_ERROR.debugDetail,
  };
}

type FriendlyError = {
  userMessage: string;
  suggestion: string;
  statusLabel: string;
  debugDetail: string;
};

const FRIENDLY_ERROR_RULES: Array<{ matchingTerms: string[]; response: FriendlyError }> = [
  {
    matchingTerms: ["missing required configuration", "mcp_base_url"],
    response: {
      userMessage: "The backend MCP analytics engine URL is not configured.",
      suggestion:
        "Set MCP_BASE_URL in backend/.env to connect to your deployed MCP host service.",
      statusLabel: "Configuration Required",
      debugDetail: "Missing required configuration: MCP_BASE_URL in backend/.env",
    },
  },
  {
    matchingTerms: [
      "streaming is disabled for this deployment",
      "streaming is unavailable for this deployment",
    ],
    response: {
      userMessage: "Streaming is unavailable for this deployment.",
      suggestion:
        "Open /chat for a non-streaming response, or check that both streaming flags are enabled.",
      statusLabel: "Streaming unavailable",
      debugDetail: "Streaming mode requested but disabled or unavailable.",
    },
  },
  {
    matchingTerms: [
      "unable to process this request",
      "unable to complete this request",
      "unable to generate an answer",
      "streaming analysis failed",
      "streaming analysis did not complete",
      "response stream ended before completion",
      "invalid stream completion",
      "invalid stream event",
      "invalid text delta",
      "streamed response exceeded the size limit",
    ],
    response: {
      userMessage: "The analytics engine could not generate a response for this question.",
      suggestion:
        "Try asking a question related to the metrics or dimensions in your selected semantic model, or select a different model.",
      statusLabel: "Unable to answer",
      debugDetail:
        "Query unprocessed: The analytics engine was unable to generate an answer for this prompt with the selected data model.",
    },
  },
  {
    matchingTerms: ["mcp host returned an unsuccessful response", "upstream", "502", "503", "504"],
    response: {
      userMessage:
        "The backend analytics engine is currently experiencing a temporary pause or maintenance.",
      suggestion:
        "Please try submitting your question again in a few moments, or select a different semantic model.",
      statusLabel: "Service Pause",
      debugDetail: "Upstream engine unavailable or maintenance pause.",
    },
  },
  {
    matchingTerms: ["timeout", "took too long", "econnaborted"],
    response: {
      userMessage: "The analysis request took longer than expected to process.",
      suggestion:
        "Try narrowing your question to a specific metric or selecting a shorter time period.",
      statusLabel: "Request Timeout",
      debugDetail: "Request timeout: upstream took too long to complete the analysis.",
    },
  },
  {
    matchingTerms: ["middleware is unavailable", "bff is running", "network error"],
    response: {
      userMessage: "Unable to connect to the Conversational BI server.",
      suggestion:
        "Please check your network connection or verify that the server service is active.",
      statusLabel: "Connection Unavailable",
      debugDetail: "Network error: unable to establish connection to BFF server.",
    },
  },
  {
    matchingTerms: ["unsafe", "content was rejected"],
    response: {
      userMessage: "This query could not be processed due to content safety policies.",
      suggestion: "Please rephrase your question to focus on business and data analytics.",
      statusLabel: "Request Filtered",
      debugDetail: "Query filtered by content safety validation.",
    },
  },
];

const DEFAULT_FRIENDLY_ERROR: FriendlyError = {
  userMessage: "We could not complete this analytical query at the moment.",
  suggestion:
    "Try asking a metric-focused question for your selected semantic model or rephrasing your prompt.",
  statusLabel: "Unable to answer",
  debugDetail: "Query unprocessed: analytics query could not be completed.",
};
