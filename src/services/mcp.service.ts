import { storageKeys } from "../config/storage";
import { postBffPrompt } from "./chat.service";
import type {
  DebugEvent,
  McpRequestAudit,
  McpRequestPayload,
  McpResponseSource,
  Message,
  UserProfile,
} from "../types/app";
import type { CountryCode, ModelId } from "../types/semantic";
import { getCountryLocale } from "../constants/locales";
import { buildPlotSpec } from "../utils/plot";
import { createId } from "../utils/session";
import { getCountry, getModel } from "../utils/semantic";
import { loadFromStorage, saveToStorage } from "../utils/storage";

type BffChatRequest = {
  session_id: string;
  semantic_model_id: ModelId;
  prompt: string;
};

type BffChatResponse = {
  answer: string;
  data?: unknown;
  debug_events?: unknown[];
  visualization?: unknown;
};

export function buildMcpRequestPayload({
  user,
  conversationId,
  modelId,
  countryCode,
  prompt,
  token,
}: {
  user: UserProfile;
  conversationId: string;
  modelId: ModelId;
  countryCode: CountryCode;
  prompt: string;
  token: string | null;
}) {
  const bearerToken = buildBearerTokenForRls(user, conversationId, token);
  const country = getCountry(countryCode);
  const locale = getCountryLocale(countryCode);
  const sentAt = new Date().toISOString();
  const requestId = createId("mcp");
  const payload: McpRequestPayload = {
    user_email_id: user.email,
    session_id: conversationId,
    semantic_model_id: modelId,
    country: country.code,
    country_name: country.name,
    language: locale.speechLocale,
    prompt,
    bearer_token_for_rls: bearerToken,
  };
  const audit: McpRequestAudit = {
    ...payload,
    bearer_token_for_rls: redactBearerToken(bearerToken),
    request_id: requestId,
    sent_at: sentAt,
  };

  return { payload, audit };
}

export async function requestMcpInsight(
  payload: McpRequestPayload,
  audit: McpRequestAudit,
): Promise<Omit<Message, "id" | "role" | "createdAt">> {
  const bffPayload: BffChatRequest = {
    session_id: payload.session_id,
    semantic_model_id: payload.semantic_model_id,
    prompt: payload.prompt,
  };

  const hostResponse = await postBffPrompt<BffChatRequest, BffChatResponse>(
    bffPayload,
    payload.bearer_token_for_rls,
  );

  const normalizedResponse = normalizeMcpResponse(hostResponse);
  return withMcpRuntime(normalizedResponse, payload, audit, "node-bff");
}

export function persistMcpRequestAudit(audit: McpRequestAudit) {
  const existing = loadFromStorage<McpRequestAudit[]>(storageKeys.mcpRequests, []);
  saveToStorage(storageKeys.mcpRequests, [audit, ...existing].slice(0, 50));
}

function normalizeMcpResponse(
  response: BffChatResponse,
): Omit<Message, "id" | "role" | "createdAt"> {
  const text = typeof response.answer === "string"
    ? response.answer
    : "BFF response received without answer text.";

  return {
    text,
    debug: normalizeDebugEvents(response.debug_events),
    plot: normalizeVisualization(response.visualization),
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
        detail: "Payload sent to Node BFF",
        payload: audit,
      },
      ...(answer.debug ?? []),
      {
        stage: "response_render",
        status: "success",
        detail: plot ? "Rendered 2D HTML plot in chat" : "Rendered text response in chat",
      },
    ],
  };
}

function normalizeDebugEvents(events: unknown[] | undefined): DebugEvent[] | undefined {
  if (!events?.length) return undefined;

  return events.map((event, index) => {
    if (event && typeof event === "object") {
      const candidate = event as Record<string, unknown>;
      return {
        stage: typeof candidate.stage === "string" ? candidate.stage : `debug_event_${index + 1}`,
        status: candidate.status === "warning" ? "warning" : "success",
        detail: typeof candidate.detail === "string" ? candidate.detail : "Debug event returned by BFF",
        payload: candidate,
      };
    }

    return {
      stage: `debug_event_${index + 1}`,
      status: "success",
      detail: "Debug event returned by BFF",
      payload: event,
    };
  });
}

function normalizeVisualization(visualization: unknown): Message["plot"] {
  if (!visualization || typeof visualization !== "object") return undefined;

  const candidate = visualization as Record<string, unknown>;
  const html = typeof candidate.html === "string" ? candidate.html : undefined;

  if (!html) return undefined;

  return {
    title: typeof candidate.title === "string" ? candidate.title : "MCP visualization",
    description: typeof candidate.description === "string"
      ? candidate.description
      : "Visualization returned by MCP through the Node BFF.",
    html,
  };
}

function buildBearerTokenForRls(
  user: UserProfile,
  conversationId: string,
  token: string | null,
) {
  const tokenForRls = token ?? user.accessToken ?? null;

  if (tokenForRls) {
    return tokenForRls.startsWith("Bearer ") ? tokenForRls : `Bearer ${tokenForRls}`;
  }

  const seed = `${user.email}|${user.authProvider}|${conversationId}`;
  const encodedSeed = btoa(
    Array.from(seed)
      .map((character) => character.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  )
    .replace(/=+$/g, "")
    .slice(0, 32);
  return `Bearer cloud-bi-rls-${encodedSeed}`;
}

function redactBearerToken(token: string) {
  if (token.length <= 24) {
    return "Bearer [redacted]";
  }
  return `${token.slice(0, 16)}...${token.slice(-8)}`;
}
