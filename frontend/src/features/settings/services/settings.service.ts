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

export async function getUserSettings(): Promise<UserSettings> {
  const response = await bffClient.get<{ settings: UserSettings }>("/settings", {
    timeout: 5_000,
  });
  return response.data.settings;
}

export async function updateUserSettings(settings: UserSettings) {
  await bffClient.put("/settings", settings);
}
