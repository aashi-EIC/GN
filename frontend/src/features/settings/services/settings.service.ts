import { bffClient } from "../../../shared/services/axios";
import type { Density } from "../../../shared/types/app";

export type UserSettings = {
  displayName?: string;
  region?: string;
  density?: Density;
  keepDebugOpen?: boolean;
  theme?: "light" | "dark";
  tourSeen?: boolean;
};

function authorization(token: string) {
  return { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` };
}

export async function getUserSettings(token: string): Promise<UserSettings> {
  const response = await bffClient.get<{ settings: UserSettings }>("/settings", {
    headers: authorization(token),
  });
  return response.data.settings;
}

export async function updateUserSettings(settings: UserSettings, token: string | null) {
  if (!token) return;
  await bffClient.put("/settings", settings, { headers: authorization(token) });
}
