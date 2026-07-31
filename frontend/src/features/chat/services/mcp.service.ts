import { storageKeys } from "../../../shared/config/storage";
import { postBffPrompt } from "./chat.service";
import type {
  McpRequestAudit,
  McpRequestPayload,
  McpResponseSource,
  Message,
  UserProfile,
} from "../../../shared/types/app";
import type { CountryCode, ModelId } from "../types/semantic";
import { getCountryLocale } from "../../../shared/constants/locales";
import { buildPlotSpec } from "../utils/plot";
import { createId } from "../../../shared/utils/session";
import { getCountry, getModel } from "../utils/semantic";
import { loadFromStorage, saveToStorage } from "../../../shared/utils/storage";


const bffChatUrl = "/chat";

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
  const hostResponse = await postBffPrompt<
    Pick<McpRequestPayload, "session_id" | "semantic_model_id" | "prompt">,
    {
      answer?: unknown;
      data?: unknown;
      debug_events?: unknown;
      visualization?: unknown;
    } & Partial<Omit<Message, "id" | "role" | "createdAt">>
  >(
    bffChatUrl,
    {
      session_id: payload.session_id,
      semantic_model_id: payload.semantic_model_id,
      prompt: payload.prompt,
    },
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
  response: {
    answer?: unknown;
    data?: unknown;
    debug_events?: unknown;
    visualization?: unknown;
  } & Partial<Omit<Message, "id" | "role" | "createdAt">>,
): Omit<Message, "id" | "role" | "createdAt"> {
  const text =
    typeof response.text === "string"
      ? response.text
      : typeof response.answer === "string"
        ? response.answer
        : typeof response.data === "string"
          ? response.data
        : "MCP response received without answer text.";

  return {
    text,
    chartTitle: response.chartTitle,
    chart: response.chart,
    metrics: response.metrics,
    table: response.table,
    actions: response.actions,
    debug: Array.isArray(response.debug)
      ? response.debug
      : Array.isArray(response.debug_events)
        ? (response.debug_events as Message["debug"])
        : undefined,
    plot:
      response.plot ??
      (response.visualization &&
      typeof response.visualization === "object" &&
      "html" in response.visualization
        ? (response.visualization as Message["plot"])
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
  return `Bearer rls-${encodedSeed}`;
}

function redactBearerToken(token: string) {
  if (token.length <= 24) {
    return "Bearer [redacted]";
  }
  return `${token.slice(0, 16)}...${token.slice(-8)}`;
}
