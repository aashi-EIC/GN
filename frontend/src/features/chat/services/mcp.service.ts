import axios from "axios";
import { storageKeys } from "../../../shared/config/storage";
import { bffClient } from "../../../shared/services/axios";
import type {
  McpRequestAudit,
  McpRequestPayload,
  Message,
  VisualizationBlock,
} from "../../../shared/types/app";
import type { ModelId } from "../types/semantic";
import { createId } from "../../../shared/utils/session";
import { loadFromStorage, saveToStorage } from "../../../shared/utils/storage";
import {
  extractVisualizationBlocks,
  normalizeVisualizationBlocks,
} from "./visualizationResponse";

export function buildMcpRequestPayload({
  conversationId,
  modelId,
  prompt,
  debug = false,
}: {
  conversationId: string;
  modelId: ModelId;
  prompt: string;
  debug?: boolean;
}) {
  const sentAt = new Date().toISOString();
  const requestId = createId("mcp");
  const payload: McpRequestPayload = {
    session_id: conversationId,
    semantic_model_id: modelId,
    prompt,
    ...(debug ? { debug: true } : {}),
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
  token?: string | null,
): Promise<Omit<Message, "id" | "role" | "createdAt">> {
  if (!token) {
    throw new Error("Sign in with Microsoft before sending a prompt.");
  }

  const maxAttempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await bffClient.post<ChatResponse>("/chat", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const answer = parseChatResponse(response.data);

      return withMcpRuntime(
        {
          text: hasTableBlock(answer.blocks)
            ? removeDuplicateMarkdownTable(answer.text)
            : answer.text,
          backendId: response.data.message_id,
          visualizations: answer.blocks?.length ? answer.blocks : undefined,
        },
        audit,
        response.data.request_id,
        response.data.debug,
      );
    } catch (error) {
      lastError = error;

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const isTransient = !error.response || (status && (status >= 500 || status === 429));
        if (isTransient && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          continue;
        }

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

  throw lastError;
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
      {
        stage: "bff_response",
        status: "success",
        detail: "Response returned by the Node BFF",
        ...(runtimeDebug?.bff_response !== undefined
          ? { payload: runtimeDebug.bff_response }
          : {}),
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
  debug?: {
    mcp_raw_response?: unknown;
    bff_response?: unknown;
  };
};

function parseChatResponse(response: ChatResponse) {
  if (!response.answer || typeof response.answer.text !== "string") {
    throw new Error("The middleware returned an unsupported response.");
  }

  const structuredBlocks = normalizeVisualizationBlocks(response.answer.blocks);
  const extracted = extractVisualizationBlocks(response.answer.text);
  const blocks = [...(structuredBlocks ?? []), ...extracted.blocks];

  return { text: extracted.text || "Query results", blocks: blocks.length ? blocks : undefined };
}

function readApiError(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const error = "error" in value ? value.error : undefined;
  if (!error || typeof error !== "object") return undefined;
  const message = "message" in error ? error.message : undefined;
  return typeof message === "string" ? message : undefined;
}

function hasTableBlock(blocks: VisualizationBlock[] | undefined) {
  return blocks?.some((block) => block.type === "table") ?? false;
}

function removeDuplicateMarkdownTable(text: string) {
  const lines = text.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    return !(trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.split("|").length >= 4);
  });
  const result = filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return result || "Query results";
}

export function formatUserFriendlyError(rawMessage: string): {
  userMessage: string;
  suggestion: string;
  statusLabel: string;
} {
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes("mcp host returned an unsuccessful response") ||
    normalized.includes("upstream") ||
    normalized.includes("502") ||
    normalized.includes("503") ||
    normalized.includes("504")
  ) {
    return {
      userMessage:
        "The backend analytics engine is currently experiencing a temporary pause or maintenance.",
      suggestion:
        "Please try submitting your question again in a few moments, or select a different semantic model.",
      statusLabel: "Service Pause",
    };
  }

  if (
    normalized.includes("invalid or expired access token") ||
    normalized.includes("expired") ||
    normalized.includes("access token") ||
    normalized.includes("sign in with microsoft")
  ) {
    return {
      userMessage: "Your Microsoft Entra ID session has expired.",
      suggestion: "Please sign out and sign in again to refresh your authorization.",
      statusLabel: "Session Expired",
    };
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("took too long") ||
    normalized.includes("econnaborted")
  ) {
    return {
      userMessage: "The analysis request took longer than expected to process.",
      suggestion: "Try narrowing your question to a specific metric or selecting a shorter time period.",
      statusLabel: "Request Timeout",
    };
  }

  if (
    normalized.includes("middleware is unavailable") ||
    normalized.includes("bff is running") ||
    normalized.includes("network error")
  ) {
    return {
      userMessage: "Unable to connect to the Conversational BI server.",
      suggestion: "Please check your network connection or verify that the server service is active.",
      statusLabel: "Connection Unavailable",
    };
  }

  return {
    userMessage: "We could not complete this analytical query at the moment.",
    suggestion: "Try rephrasing your prompt or picking another semantic model from the top bar.",
    statusLabel: "Notice",
  };
}
