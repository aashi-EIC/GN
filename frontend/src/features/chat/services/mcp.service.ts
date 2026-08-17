import { storageKeys } from "../../../shared/config/storage";
import { postBffPrompt } from "./chat.service";
import type {
  McpRequestAudit,
  McpRequestPayload,
  Message,
  VisualizationBlock,
} from "../../../shared/types/app";
import type { ModelId } from "../types/semantic";
import { createId } from "../../../shared/utils/session";
import { loadFromStorage, saveToStorage } from "../../../shared/utils/storage";


const bffChatUrl = "/chat";

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
  token: string | null,
): Promise<Omit<Message, "id" | "role" | "createdAt">> {
  if (!token) {
    throw new Error("An Entra access token is required to call the Node BFF");
  }
  const response = await postBffPrompt<
    McpRequestPayload,
    {
      answer: {
        text: string;
        blocks?: VisualizationBlock[];
      };
      message_id?: unknown;
    }
  >(
    bffChatUrl,
    {
      session_id: payload.session_id,
      semantic_model_id: payload.semantic_model_id,
      prompt: payload.prompt,
    },
    token,
    audit.request_id,
  );

  return {
    text: response.answer.text,
    backendId: typeof response.message_id === "string" ? response.message_id : undefined,
    visualizations: response.answer.blocks,
    debug: [
      {
        stage: "mcp_request_payload",
        status: "success",
        detail: "Payload sent to Node BFF",
        payload: audit,
      },
      {
        stage: "response_render",
        status: "success",
        detail: response.answer.blocks?.length
          ? "Rendered structured response blocks"
          : "Rendered text response",
      },
    ],
  };
}

export function persistMcpRequestAudit(audit: McpRequestAudit) {
  const existing = loadFromStorage<McpRequestAudit[]>(storageKeys.mcpRequests, []);
  saveToStorage(storageKeys.mcpRequests, [audit, ...existing].slice(0, 50));
}
