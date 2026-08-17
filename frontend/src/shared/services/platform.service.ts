import type { IssueReport } from "../types/app";
import type { SemanticModel } from "../../features/chat/types/semantic";
import { bffClient } from "./axios";

type BackendSemanticModel = {
  id: string;
  name: string;
  short: string;
  nickname?: string;
  description: string;
  guide?: string;
  color?: string;
  examplePrompts: string[];
  supportedVisualizations: string[];
  enabled: boolean;
};

export type BootstrapResponse = {
  user: {
    id: string;
    email: string | null;
    roles: string[];
    scopes: string[];
    permissions: string[];
    allowed_semantic_model_ids: string[];
  };
  semantic_models: BackendSemanticModel[];
  features: {
    debugMode: boolean;
    issueReporting: boolean;
    voiceInput: boolean;
    chartDownload: boolean;
  };
  limits: {
    maximum_prompt_length: number;
    maximum_history_items: number;
  };
};

function authorization(token: string) {
  return { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` };
}

export async function fetchBootstrap(token: string) {
  const response = await bffClient.get<BootstrapResponse>("/bootstrap", {
    headers: authorization(token),
  });
  return response.data;
}

export function toFrontendModel(model: BackendSemanticModel): SemanticModel {
  return {
    id: model.id,
    name: model.name,
    short: model.short,
    nickname: model.nickname ?? model.name,
    description: model.description,
    guide: model.guide ?? model.description,
    color: model.color ?? "#005D8F",
    prompts: model.examplePrompts,
  };
}

export async function submitMessageFeedback(
  token: string,
  messageId: string,
  rating: "helpful" | "not_helpful",
) {
  await bffClient.post(
    `/messages/${encodeURIComponent(messageId)}/feedback`,
    { rating },
    { headers: authorization(token) },
  );
}

export async function removeMessageFeedback(token: string, messageId: string) {
  await bffClient.delete(`/messages/${encodeURIComponent(messageId)}/feedback`, {
    headers: authorization(token),
  });
}

export async function deleteSession(token: string, sessionId: string) {
  await bffClient.delete(`/sessions/${encodeURIComponent(sessionId)}`, {
    headers: authorization(token),
  });
}

export async function submitIssueReport(
  token: string,
  issue: IssueReport,
  backendMessageId?: string,
) {
  const response = await bffClient.post<{ issue: { id: string } }>(
    "/issues",
    {
      ...(issue.conversationId ? { session_id: issue.conversationId } : {}),
      ...(backendMessageId ? { message_id: backendMessageId } : {}),
      semantic_model_id: issue.modelId,
      category: issue.category,
      severity: issue.severity.toLowerCase(),
      description: issue.description,
    },
    { headers: authorization(token) },
  );
  return response.data.issue;
}
