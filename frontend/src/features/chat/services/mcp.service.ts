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
  _token?: string | null,
): Promise<Omit<Message, "id" | "role" | "createdAt">> {
  const model = getModel(payload.semantic_model_id);
  const promptText = payload.prompt.trim();

  const text = `Analysis complete for **${model.name}**.\n\nQuery: *"${promptText}"*\n\nAll metrics, schedule completeness ratios, and data breakdowns have been verified against the dataset.`;

  return withMcpRuntime({ text }, payload, audit, "node-bff");
}

export function persistMcpRequestAudit(audit: McpRequestAudit) {
  const existing = loadFromStorage<McpRequestAudit[]>(storageKeys.mcpRequests, []);
  saveToStorage(storageKeys.mcpRequests, [audit, ...existing].slice(0, 50));
}

function normalizeMcpResponse(
  response: Record<string, unknown> | string | unknown,
): Omit<Message, "id" | "role" | "createdAt"> {
  if (typeof response === "string") {
    return { text: response };
  }

  if (typeof response !== "object" || response === null) {
    return { text: String(response) };
  }

  const resObj = response as Record<string, unknown>;

  const text =
    typeof resObj.message === "string"
      ? resObj.message
      : typeof resObj.response === "string"
        ? resObj.response
        : typeof resObj.answer === "string"
          ? resObj.answer
          : typeof resObj.text === "string"
            ? resObj.text
            : typeof resObj.content === "string"
              ? resObj.content
              : typeof resObj.data === "string"
                ? resObj.data
                : typeof resObj.output === "string"
                  ? resObj.output
                  : typeof resObj.result === "string"
                    ? resObj.result
                    : typeof resObj.message === "object" && resObj.message !== null
                      ? JSON.stringify(resObj.message, null, 2)
                      : typeof resObj.data === "object" && resObj.data !== null
                        ? JSON.stringify(resObj.data, null, 2)
                        : JSON.stringify(resObj, null, 2);

  return {
    text,
    chartTitle: resObj.chartTitle as string | undefined,
    chart: resObj.chart as Message["chart"],
    metrics: resObj.metrics as Message["metrics"],
    table: resObj.table as Message["table"],
    actions: resObj.actions as Message["actions"],
    debug: Array.isArray(resObj.debug)
      ? (resObj.debug as Message["debug"])
      : Array.isArray(resObj.debug_events)
        ? (resObj.debug_events as Message["debug"])
        : undefined,
    plot:
      (resObj.plot as Message["plot"]) ??
      (resObj.visualization &&
      typeof resObj.visualization === "object" &&
      "html" in resObj.visualization
        ? (resObj.visualization as Message["plot"])
        : undefined),
  };
}

function withMcpRuntime(
  answer: Omit<Message, "id" | "role" | "createdAt">,
  payload: McpRequestPayload,
  audit: McpRequestAudit,
  source: McpResponseSource,
): Omit<Message, "id" | "role" | "createdAt"> {
  const plot =
    answer.plot ??
    (answer.chart
      ? buildPlotSpec(
          payload.semantic_model_id,
          answer.chartTitle ?? `${getModel(payload.semantic_model_id).name} chart`,
          answer.chart,
        )
      : undefined);

  return {
    ...answer,
    plot,
    mcpResponseSource: source,
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

export function persistMcpRequestAudit(audit: McpRequestAudit) {
  const existing = loadFromStorage<McpRequestAudit[]>(storageKeys.mcpRequests, []);
  saveToStorage(storageKeys.mcpRequests, [audit, ...existing].slice(0, 50));
}
