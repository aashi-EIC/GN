import { bffClient } from "../../../shared/services/axios";

async function makeRequest<T>(
  _method: "get" | "post" | "put" | "delete",
  url: string,
  _token: string | null,
  _data?: unknown,
): Promise<T> {
  if (url === "/sessions" || url.startsWith("/sessions")) {
    if (url.includes("/") && url.split("/").length > 2) {
      return { id: url.split("/")[2], messages: [] } as unknown as T;
    }
    return { sessions: [] } as unknown as T;
  }

  if (url === "/settings") {
    return { success: true } as unknown as T;
  }

  if (url === "/feedback" || url === "/issues") {
    return { success: true } as unknown as T;
  }

  return {} as unknown as T;
}

export async function postBffPrompt<TPayload, TResponse>(
  url: string,
  payload: TPayload,
  bearerToken: string,
  _correlationId?: string,
) {
  return makeRequest<TResponse>("post", url, bearerToken, payload);
}

export async function getSessions(token: string | null) {
  return makeRequest<{ sessions: Record<string, unknown>[] }>("get", "/sessions", token);
}

export async function getSessionDetails(sessionId: string, token: string | null) {
  return makeRequest<Record<string, unknown>>("get", `/sessions/${sessionId}`, token);
}

export async function deleteSession(sessionId: string, token: string | null) {
  return makeRequest<void>("delete", `/sessions/${sessionId}`, token);
}

export async function clearAllSessions(token: string | null) {
  return makeRequest<void>("delete", "/sessions", token);
}

import type { Density } from "../../../shared/types/app";

export async function getUserSettings(token: string | null) {
  return makeRequest<{
    displayName?: string;
    region?: string;
    density?: Density;
    keepDebugOpen?: boolean;
    theme?: "light" | "dark";
    tourSeen?: boolean;
  }>("get", "/settings", token);
}

export async function updateUserSettings(
  settings: {
    displayName?: string;
    region?: string;
    density?: string;
    keepDebugOpen?: boolean;
    theme?: string;
    tourSeen?: boolean;
  },
  token: string | null,
) {
  return makeRequest<{ success: boolean }>("put", "/settings", token, settings);
}

export async function submitFeedback(
  feedback: { messageId: string; value: string; comment?: string },
  token: string | null,
) {
  return makeRequest<{ success: boolean }>("post", "/feedback", token, feedback);
}

export async function submitIssueReport(
  issue: { id: string; title: string; description: string; debugContext?: Record<string, unknown> },
  token: string | null,
) {
  return makeRequest<{ success: boolean }>("post", "/issues", token, issue);
}
