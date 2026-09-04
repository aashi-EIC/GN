import type { AuthenticatedUser } from "../../types.js";

export type UserSettings = {
  displayName: string;
  region: string;
  density: "comfortable" | "compact";
  keepDebugOpen: boolean;
  theme: "light" | "dark";
  tourSeen: boolean;
};

export type UserSettingsInput = Partial<UserSettings>;

const defaultSettings: UserSettings = {
  displayName: "",
  region: "Global",
  density: "comfortable",
  keepDebugOpen: false,
  theme: "light",
  tourSeen: false,
};

const settingsByUser = new Map<string, UserSettings>();

function userKey(user: AuthenticatedUser) {
  return `${user.tenantId}:${user.objectId}`;
}

export function getUserSettings(user: AuthenticatedUser): UserSettings {
  return settingsByUser.get(userKey(user)) ?? defaultSettings;
}

export function saveUserSettings(user: AuthenticatedUser, input: UserSettingsInput): UserSettings {
  const settings = { ...getUserSettings(user), ...input };
  settingsByUser.set(userKey(user), settings);
  return settings;
}
