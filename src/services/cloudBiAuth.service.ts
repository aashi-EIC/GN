import { env } from "../config/env";
import type { CloudBiLoginCredentials, UserProfile } from "../types/app";
import { cloudBiEmail, nameFromCloudBiId } from "../utils/identity";
import { mcpClient } from "./axios";

type CloudBiAuthResponse = {
  authenticated?: boolean;
  user?: Partial<UserProfile>;
  email?: string;
  name?: string;
  cloudBiId?: string;
  accessToken?: string;
  token?: string;
  bearerToken?: string;
  expiresAt?: string;
  tokenExpiresAt?: string;
};

export async function loginWithCloudBi(
  credentials: CloudBiLoginCredentials,
): Promise<UserProfile> {
  const { data } = await mcpClient.post<CloudBiAuthResponse>(
    env.cloudBiLoginUrl,
    credentials,
    { withCredentials: true },
  );
  return normalizeCloudBiResponse(data, credentials.cloudBiId, credentials.name);
}

export async function restoreCloudBiSession(): Promise<UserProfile | null> {
  const { data } = await mcpClient.get<CloudBiAuthResponse>(env.cloudBiSessionUrl, {
    withCredentials: true,
  });

  if (data.authenticated === false) {
    return null;
  }

  return normalizeCloudBiResponse(data);
}

export async function logoutCloudBiSession() {
  await mcpClient.post(env.cloudBiLogoutUrl, undefined, { withCredentials: true });
}

function normalizeCloudBiResponse(
  response: CloudBiAuthResponse,
  fallbackCloudBiId = "",
  fallbackName = "",
): UserProfile {
  const profile = response.user ?? {};
  const cloudBiId = String(profile.cloudBiId ?? response.cloudBiId ?? fallbackCloudBiId).trim();
  const accessToken = String(
    profile.accessToken ?? response.accessToken ?? response.token ?? response.bearerToken ?? "",
  ).trim();
  const email = String(profile.email ?? response.email ?? cloudBiEmail(cloudBiId)).trim();
  const name = String(
    profile.name ?? response.name ?? fallbackName.trim() ?? nameFromCloudBiId(cloudBiId),
  ).trim();
  const tokenExpiresAt = String(
    profile.tokenExpiresAt ?? response.tokenExpiresAt ?? response.expiresAt ?? "",
  ).trim();

  if (!cloudBiId) {
    throw new Error("Cloud BI authentication did not return a Cloud BI ID.");
  }

  if (!accessToken) {
    throw new Error("Cloud BI authentication did not return an RLS bearer token.");
  }

  return {
    email,
    name: name || nameFromCloudBiId(cloudBiId),
    authProvider: "Cloud BI ID",
    cloudBiId,
    accessToken,
    tokenExpiresAt: tokenExpiresAt || undefined,
  };
}
