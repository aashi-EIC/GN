import { bffClient } from "../../../shared/services/axios";

export async function postBffPrompt<TPayload, TResponse>(
  url: string,
  payload: TPayload,
  bearerToken: string,
) {
  const authorization = bearerToken.startsWith("Bearer ")
    ? bearerToken
    : `Bearer ${bearerToken}`;

  const response = await bffClient.post<TResponse>(url, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
  });

  return response.data;
}
