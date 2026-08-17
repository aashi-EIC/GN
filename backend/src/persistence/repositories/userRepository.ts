import type { AuthenticatedUser } from "../../types.js";

type UserSettingsRecord = {
  displayName: string;
  region: string;
  density: string;
  keepDebugOpen: boolean;
  theme: string;
  tourSeen: boolean;
};

const userSettingsStore = new Map<string, UserSettingsRecord>();
const feedbackStore = new Map<string, { value: string; comment: string }>();
const issueStore = new Map<string, { title: string; description: string; debugContext: unknown }>();

export async function getUserSettings(user: AuthenticatedUser) {
  const key = `${user.tenantId}:${user.objectId}`;
  return userSettingsStore.get(key) || {
    displayName: "",
    region: "Global",
    density: "comfortable",
    keepDebugOpen: false,
    theme: "light",
    tourSeen: false,
  };
}

export interface UserSettingsInput {
  displayName?: string;
  region?: string;
  density?: string;
  keepDebugOpen?: boolean;
  theme?: string;
  tourSeen?: boolean;
}

export interface FeedbackInput {
  messageId: string;
  value: string;
  comment?: string;
}

export interface IssueInput {
  id: string;
  title: string;
  description: string;
  debugContext?: unknown;
}

export async function saveUserSettings(user: AuthenticatedUser, settings: UserSettingsInput) {
  const key = `${user.tenantId}:${user.objectId}`;
  const existing = await getUserSettings(user);
  userSettingsStore.set(key, {
    ...existing,
    displayName: settings.displayName ?? existing.displayName,
    region: settings.region ?? existing.region,
    density: settings.density ?? existing.density,
    keepDebugOpen: settings.keepDebugOpen ?? existing.keepDebugOpen,
    theme: settings.theme ?? existing.theme,
    tourSeen: settings.tourSeen ?? existing.tourSeen,
  });
}

export async function saveMessageFeedback(_user: AuthenticatedUser, feedback: FeedbackInput) {
  feedbackStore.set(feedback.messageId, {
    value: feedback.value,
    comment: feedback.comment || "",
  });
}

export async function saveIssueReport(_user: AuthenticatedUser, issue: IssueInput) {
  issueStore.set(issue.id, {
    title: issue.title,
    description: issue.description,
    debugContext: issue.debugContext,
  });
}
