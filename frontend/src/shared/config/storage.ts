import type { SettingsState } from "../types/app";

export const storageKeys = {
  conversations: "conversational-bi-conversations",
  browserUserId: "conversational-bi-browser-user-id",
  user: "conversational-bi-user",
  settings: "conversational-bi-settings",
  feedback: "conversational-bi-feedback",
  issues: "conversational-bi-issues",
  mcpRequests: "conversational-bi-mcp-requests",
  tourSeen: "conversational-bi-tour-seen",
  ssoProvider: "conversational-bi-sso-provider",
} as const;

export const defaultSettings: SettingsState = {
  displayName: "",
  region: "Global",
  density: "comfortable",
  keepDebugOpen: false,
  tablePageSize: 10,
};
