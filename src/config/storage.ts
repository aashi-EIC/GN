import type { SettingsState } from "../types/app";

export const storageKeys = {
  conversations: "gracenote-intelligence-conversations",
  user: "gracenote-intelligence-user",
  settings: "gracenote-intelligence-settings",
  feedback: "gracenote-intelligence-feedback",
  issues: "gracenote-intelligence-issues",
  mcpRequests: "gracenote-intelligence-mcp-requests",
  tourSeen: "gracenote-intelligence-tour-seen",
  theme: "gracenote-intelligence-theme",
  ssoProvider: "gracenote-intelligence-sso-provider",
} as const;

export const defaultSettings: SettingsState = {
  displayName: "",
  region: "Global",
  density: "comfortable",
  keepDebugOpen: false,
};
