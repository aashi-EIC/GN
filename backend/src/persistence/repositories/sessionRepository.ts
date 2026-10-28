import { randomUUID } from "node:crypto";
import { config } from "../../config/env.js";
import { AppError, ConflictError, NotFoundError } from "../../errors.js";
import type { AuthenticatedUser, McpHostResponse } from "../../types.js";

type SessionRecord = {
  id: string;
  owner_tenant_id: string;
  owner_object_id: string;
  semantic_model_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  expiresAt: number;
  pending: Set<string>;
  messageIds: Set<string>;
};

type MessageRecord = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  normalized_response: McpHostResponse | null;
  correlation_id: string;
  created_at: Date;
};

type CachedMessage = {
  sessionId: string;
  correlationId: string;
  serialized: string;
  bytes: number;
};

type SessionOwnerInput = { id: string; user: AuthenticatedUser };
type SessionCacheOptions = {
  maxBytes: number;
  maxSessions: number;
  maxMessages: number;
  ttlMs: number;
};

function sessionView(session: SessionRecord) {
  return {
    id: session.id,
    semantic_model_id: session.semantic_model_id,
    title: session.title,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

/** A bounded, best-effort cache, independent of browser history and MCP session context. */
export function createSessionRepository(options: SessionCacheOptions, clock = Date.now) {
  if (Object.values(options).some((value) => !Number.isSafeInteger(value) || value <= 0))
    throw new RangeError("Invalid session cache limits");
  const sessions = new Map<string, SessionRecord>();
  const messages = new Map<string, CachedMessage>();
  let messageBytes = 0;

  function removeMessage(id: string) {
    const message = messages.get(id);
    if (!message) return;
    messageBytes -= message.bytes;
    messages.delete(id);
    sessions.get(message.sessionId)?.messageIds.delete(id);
  }

  function clearMessages(session: SessionRecord) {
    for (const id of session.messageIds) removeMessage(id);
  }

  function removeSession(session: SessionRecord) {
    clearMessages(session);
    sessions.delete(session.id);
  }

  function prune() {
    const now = clock();
    for (const session of sessions.values()) {
      if (!session.pending.size && session.expiresAt <= now) removeSession(session);
    }
  }

  function touch(session: SessionRecord) {
    session.expiresAt = clock() + options.ttlMs;
    sessions.delete(session.id);
    sessions.set(session.id, session);
  }

  function ownedSession({ id, user }: SessionOwnerInput) {
    const session = sessions.get(id);
    if (session && !session.pending.size && session.expiresAt <= clock()) removeSession(session);
    if (
      !session ||
      !sessions.has(id) ||
      session.deleted_at ||
      session.owner_tenant_id !== user.tenantId ||
      session.owner_object_id !== user.objectId
    )
      throw new NotFoundError("Session not found");
    touch(session);
    return session;
  }

  function addSession(id: string, user: AuthenticatedUser, modelId: string, title: string) {
    prune();
    if (sessions.size >= options.maxSessions) {
      const candidate = [...sessions.values()].find((session) => !session.pending.size);
      if (!candidate)
        throw new AppError(
          503,
          "SESSION_CACHE_FULL",
          "The server is busy. Please try again shortly.",
        );
      removeSession(candidate);
    }
    const now = new Date(clock());
    const session: SessionRecord = {
      id,
      owner_tenant_id: user.tenantId,
      owner_object_id: user.objectId,
      semantic_model_id: modelId,
      title: title.slice(0, 120),
      created_at: now,
      updated_at: now,
      expiresAt: clock() + options.ttlMs,
      pending: new Set(),
      messageIds: new Set(),
    };
    sessions.set(id, session);
    return session;
  }

  function addMessage(session: SessionRecord, record: MessageRecord) {
    const serialized = JSON.stringify(record);
    // Store serialized responses so the cache does not retain arbitrary upstream object graphs.
    const bytes = serialized.length * 2 + 256;
    if (bytes > options.maxBytes) return;
    while (session.messageIds.size >= 100) removeMessage(session.messageIds.values().next().value!);
    while (messages.size >= options.maxMessages || messageBytes + bytes > options.maxBytes) {
      const oldest = messages.keys().next().value;
      if (!oldest) break;
      removeMessage(oldest);
    }
    messages.set(record.id, {
      sessionId: session.id,
      correlationId: record.correlation_id,
      serialized,
      bytes,
    });
    session.messageIds.add(record.id);
    messageBytes += bytes;
  }

  async function assertOwnedSession(input: SessionOwnerInput) {
    return sessionView(ownedSession(input));
  }

  async function createOwnedSession(input: {
    semanticModelId: string;
    title: string;
    user: AuthenticatedUser;
  }) {
    return sessionView(addSession(randomUUID(), input.user, input.semanticModelId, input.title));
  }

  async function ensureOwnedSession(input: {
    id: string;
    semanticModelId: string;
    prompt: string;
    user: AuthenticatedUser;
    correlationId: string;
  }) {
    prune();
    const session = sessions.has(input.id)
      ? ownedSession(input)
      : addSession(input.id, input.user, input.semanticModelId, input.prompt);
    if (session.semantic_model_id !== input.semanticModelId)
      throw new ConflictError("A session cannot change its semantic model");
    session.pending.add(input.correlationId);
    const id = randomUUID();
    addMessage(session, {
      id,
      session_id: session.id,
      role: "user",
      content: input.prompt,
      normalized_response: null,
      correlation_id: input.correlationId,
      created_at: new Date(clock()),
    });
    session.updated_at = new Date(clock());
    return id;
  }

  function releaseSessionRequest(id: string, correlationId: string) {
    sessions.get(id)?.pending.delete(correlationId);
    prune();
  }

  async function saveAssistantMessage(
    sessionId: string,
    correlationId: string,
    response: McpHostResponse,
  ) {
    const session = sessions.get(sessionId);
    if (!session || session.deleted_at) throw new NotFoundError("Session not found");
    const id = randomUUID();
    addMessage(session, {
      id,
      session_id: sessionId,
      role: "assistant",
      content: response.answer.text,
      normalized_response: response,
      correlation_id: correlationId,
      created_at: new Date(clock()),
    });
    session.updated_at = new Date(clock());
    touch(session);
    return id;
  }

  async function listOwnedSessions(input: {
    user: AuthenticatedUser;
    limit: number;
    cursor?: string;
    search?: string;
    semanticModelId?: string;
  }) {
    prune();
    const cursor = input.cursor ? new Date(input.cursor).getTime() : undefined;
    const search = input.search?.toLocaleLowerCase();
    const matches = [...sessions.values()]
      .filter(
        (session) =>
          !session.deleted_at &&
          session.owner_tenant_id === input.user.tenantId &&
          session.owner_object_id === input.user.objectId &&
          (cursor === undefined || session.updated_at.getTime() < cursor) &&
          (!search || session.title.toLocaleLowerCase().includes(search)) &&
          (!input.semanticModelId || session.semantic_model_id === input.semanticModelId),
      )
      .sort((left, right) => right.updated_at.getTime() - left.updated_at.getTime());
    const page = matches.slice(0, input.limit);
    return {
      sessions: page.map(sessionView),
      next_cursor:
        matches.length > input.limit ? (page.at(-1)?.updated_at.toISOString() ?? null) : null,
    };
  }

  async function getOwnedSession(user: AuthenticatedUser, id: string) {
    const session = ownedSession({ user, id });
    const sessionMessages = [...session.messageIds].flatMap((messageId) => {
      const cached = messages.get(messageId);
      if (!cached) return [];
      const record = JSON.parse(cached.serialized) as MessageRecord;
      record.created_at = new Date(record.created_at);
      return [record];
    });
    return { ...sessionView(session), messages: sessionMessages };
  }

  async function renameOwnedSession(user: AuthenticatedUser, id: string, title: string) {
    const session = ownedSession({ user, id });
    session.title = title;
    session.updated_at = new Date(clock());
    return sessionView(session);
  }

  async function deleteOwnedSession(user: AuthenticatedUser, id: string) {
    const session = ownedSession({ user, id });
    clearMessages(session);
    session.deleted_at = new Date(clock());
    session.updated_at = session.deleted_at;
    session.title = "";
  }

  async function assertOwnedMessage(user: AuthenticatedUser, messageId: string) {
    const message = messages.get(messageId);
    if (!message) throw new NotFoundError("Message not found");
    const session = ownedSession({ id: message.sessionId, user });
    return {
      id: messageId,
      session_id: session.id,
      correlation_id: message.correlationId,
      semantic_model_id: session.semantic_model_id,
    };
  }

  return {
    assertOwnedSession,
    createOwnedSession,
    ensureOwnedSession,
    releaseSessionRequest,
    saveAssistantMessage,
    listOwnedSessions,
    getOwnedSession,
    renameOwnedSession,
    deleteOwnedSession,
    assertOwnedMessage,
    prune,
  };
}

const repository = createSessionRepository({
  maxBytes: config.SESSION_CACHE_MAX_BYTES,
  maxSessions: config.SESSION_CACHE_MAX_SESSIONS,
  maxMessages: config.SESSION_CACHE_MAX_MESSAGES,
  ttlMs: config.SESSION_CACHE_TTL_MS,
});
const cleanup = setInterval(repository.prune, Math.min(config.SESSION_CACHE_TTL_MS, 60_000));
cleanup.unref();

export const {
  assertOwnedSession,
  createOwnedSession,
  ensureOwnedSession,
  releaseSessionRequest,
  saveAssistantMessage,
  listOwnedSessions,
  getOwnedSession,
  renameOwnedSession,
  deleteOwnedSession,
  assertOwnedMessage,
} = repository;
