import { randomUUID } from "node:crypto";
import { ConflictError } from "../../errors.js";
import type { AuthenticatedUser } from "../../types.js";
import { assertOwnedMessage, assertOwnedSession } from "./sessionRepository.js";

type FeedbackRecord = {
  id: string;
  message_id: string;
  owner_tenant_id: string;
  owner_object_id: string;
  rating: "helpful" | "not_helpful";
  reason: string | null;
  created_at: Date;
  updated_at: Date;
};

const feedbackByOwnerAndMessage = new Map<string, FeedbackRecord>();
const issueReports = new Map<string, Record<string, unknown>>();

function feedbackKey(user: AuthenticatedUser, messageId: string) {
  return `${user.tenantId}:${user.objectId}:${messageId}`;
}

export async function saveMessageFeedback(input: {
  messageId: string;
  rating: "helpful" | "not_helpful";
  reason?: string;
  user: AuthenticatedUser;
}) {
  await assertOwnedMessage(input.user, input.messageId);
  const key = feedbackKey(input.user, input.messageId);
  const current = feedbackByOwnerAndMessage.get(key);
  const now = new Date();
  const feedback: FeedbackRecord = {
    id: current?.id ?? randomUUID(),
    message_id: input.messageId,
    owner_tenant_id: input.user.tenantId,
    owner_object_id: input.user.objectId,
    rating: input.rating,
    reason: input.reason ?? null,
    created_at: current?.created_at ?? now,
    updated_at: now,
  };
  feedbackByOwnerAndMessage.set(key, feedback);
  return feedback;
}

export async function deleteMessageFeedback(user: AuthenticatedUser, messageId: string) {
  await assertOwnedMessage(user, messageId);
  feedbackByOwnerAndMessage.delete(feedbackKey(user, messageId));
}

export async function createIssueReport(input: {
  sessionId?: string;
  messageId?: string;
  semanticModelId: string;
  category: string;
  severity: string;
  description: string;
  correlationId: string;
  user: AuthenticatedUser;
}) {
  if (input.sessionId) {
    const session = await assertOwnedSession({ id: input.sessionId, user: input.user });
    if (session.semantic_model_id !== input.semanticModelId) {
      throw new ConflictError("The issue semantic model does not match the selected session");
    }
  }
  if (input.messageId) {
    const message = await assertOwnedMessage(input.user, input.messageId);
    if (input.sessionId && message.session_id !== input.sessionId) {
      throw new ConflictError("The selected message does not belong to the selected session");
    }
    if (message.semantic_model_id !== input.semanticModelId) {
      throw new ConflictError("The issue semantic model does not match the selected message");
    }
  }

  const id = randomUUID();
  const issue = {
    id,
    session_id: input.sessionId ?? null,
    message_id: input.messageId ?? null,
    semantic_model_id: input.semanticModelId,
    category: input.category,
    severity: input.severity,
    description: input.description,
    correlation_id: input.correlationId,
    created_at: new Date(),
  };
  issueReports.set(id, issue);
  return issue;
}
