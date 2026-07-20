import { mcpClient } from "./axios";

export async function postMcpPrompt<TPayload, TResponse>(
  url: string,
  payload: TPayload,
  bearerToken: string,
) {
  const response = await mcpClient.post<TResponse>(url, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: bearerToken,
    },
  });

  return response.data;
}
