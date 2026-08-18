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

export function buildMcpRequestPayload({
  conversationId,
  modelId,
  prompt,
}: {
  conversationId: string;
  modelId: ModelId;
  prompt: string;
}) {
  const sentAt = new Date().toISOString();
  const requestId = createId("mcp");
  const payload: McpRequestPayload = {
    session_id: conversationId,
    semantic_model_id: modelId,
    prompt,
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
    );
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
};

function parseChatResponse(response: ChatResponse) {
  if (!response.answer || typeof response.answer.text !== "string") {
    throw new Error("The middleware returned an unsupported response.");
  }

  const blocks = Array.isArray(response.answer.blocks)
    ? (response.answer.blocks as VisualizationBlock[])
    : undefined;

  return { text: response.answer.text, blocks };
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
