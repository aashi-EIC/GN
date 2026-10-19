import { bffClient } from "../../../shared/services/axios";

export async function fetchSessionTitle(
  sessionId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const { data } = await bffClient.get<{ title: unknown }>(
    `/chat/sessions/${encodeURIComponent(sessionId)}/title`,
    {
      signal,
      timeout: 10_000,
    },
  );

  if (typeof data.title !== "string") return null;

  const title = data.title.trim();
  return title && title.length <= 1000 ? title : null;
}
