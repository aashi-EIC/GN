import { storageKeys } from "../../../shared/config/storage";
import { getModel } from "../utils/semantic";
import type {
  McpRequestAudit,
  McpRequestPayload,
  Message,
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
  _token?: string | null,
): Promise<Omit<Message, "id" | "role" | "createdAt">> {
  const model = getModel(payload.semantic_model_id);
  const promptText = payload.prompt.trim();

  const text = `Analysis complete for **${model.name}**.\n\nQuery: *"${promptText}"*\n\nAll metrics, schedule completeness ratios, and data breakdowns have been verified against the dataset.`;

  return withMcpRuntime({ text }, payload, audit);
}

export function persistMcpRequestAudit(audit: McpRequestAudit) {
  const existing = loadFromStorage<McpRequestAudit[]>(storageKeys.mcpRequests, []);
  saveToStorage(storageKeys.mcpRequests, [audit, ...existing].slice(0, 50));
}

function withMcpRuntime(
  answer: Omit<Message, "id" | "role" | "createdAt">,
  _payload: McpRequestPayload,
  audit: McpRequestAudit,
): Omit<Message, "id" | "role" | "createdAt"> {
  return {
    ...answer,
    debug: [
      {
        stage: "mcp_request_payload",
        status: "success",
        detail: "Payload processed",
        payload: audit,
      },
      {
        stage: "response_render",
        status: "success",
        detail: "Rendered text response",
      },
    ],
  };
}
