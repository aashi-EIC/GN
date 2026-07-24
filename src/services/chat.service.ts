import { bffClient } from "./axios";

export async function postBffPrompt<TPayload, TResponse>(
  payload: TPayload,
  bearerToken: string,
) {
  const authorization = bearerToken.startsWith("Bearer ")
    ? bearerToken
    : `Bearer ${bearerToken}`;

  const response = await bffClient.post<TResponse>("/chat", payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
  });

  return response.data;
}
