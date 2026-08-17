import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../../errors.js';
import type { AuthenticatedUser, McpHostResponse } from '../../types.js';

type SessionRecord = {
  id: string;
  owner_tenant_id: string;
  owner_object_id: string;
  semantic_model_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
};

type MessageRecord = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  normalized_response: McpHostResponse | null;
  correlation_id: string;
  created_at: Date;
};

type SessionOwnerInput = {
  id: string;
  user: AuthenticatedUser;
};

const sessions = new Map<string, SessionRecord>();
const messages = new Map<string, MessageRecord>();

function sessionView(session: SessionRecord) {
  return {
    id: session.id,
    semantic_model_id: session.semantic_model_id,
    title: session.title,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

export async function assertOwnedSession({ id, user }: SessionOwnerInput) {
  const session = sessions.get(id);
  if (
    !session
    || session.deleted_at
    || session.owner_tenant_id !== user.tenantId
    || session.owner_object_id !== user.objectId
  ) {
    throw new NotFoundError('Session not found');
  }
  return sessionView(session);
}

export async function createOwnedSession(input: {
  semanticModelId: string;
  title: string;
  user: AuthenticatedUser;
}) {
  const now = new Date();
  const session: SessionRecord = {
    id: randomUUID(),
    owner_tenant_id: input.user.tenantId,
    owner_object_id: input.user.objectId,
    semantic_model_id: input.semanticModelId,
    title: input.title,
    created_at: now,
    updated_at: now,
  };
  sessions.set(session.id, session);
  return sessionView(session);
}

export async function ensureOwnedSession(input: {
  id: string;
  semanticModelId: string;
  prompt: string;
  user: AuthenticatedUser;
  correlationId: string;
}) {
  let session = sessions.get(input.id);
  if (!session) {
    const now = new Date();
    session = {
      id: input.id,
      owner_tenant_id: input.user.tenantId,
      owner_object_id: input.user.objectId,
      semantic_model_id: input.semanticModelId,
      title: input.prompt.slice(0, 120),
      created_at: now,
      updated_at: now,
    };
    sessions.set(session.id, session);
  }

  if (
    session.deleted_at
    || session.owner_tenant_id !== input.user.tenantId
    || session.owner_object_id !== input.user.objectId
  ) {
    throw new NotFoundError('Session not found');
  }
  if (session.semantic_model_id !== input.semanticModelId) {
    throw new ConflictError('A session cannot change its semantic model');
  }

  const messageId = randomUUID();
  messages.set(messageId, {
    id: messageId,
    session_id: session.id,
    role: 'user',
    content: input.prompt,
    normalized_response: null,
    correlation_id: input.correlationId,
    created_at: new Date(),
  });
  session.updated_at = new Date();
  return messageId;
}

export async function saveAssistantMessage(
  sessionId: string,
  correlationId: string,
  response: McpHostResponse,
) {
  if (!sessions.has(sessionId)) throw new NotFoundError('Session not found');

  const id = randomUUID();
  messages.set(id, {
    id,
    session_id: sessionId,
    role: 'assistant',
    content: response.answer.text,
    normalized_response: response,
    correlation_id: correlationId,
    created_at: new Date(),
  });
  return id;
}

export async function listOwnedSessions(input: {
  user: AuthenticatedUser;
  limit: number;
  cursor?: string;
  search?: string;
  semanticModelId?: string;
}) {
  const cursor = input.cursor ? new Date(input.cursor).getTime() : undefined;
  const search = input.search?.toLocaleLowerCase();
  const matches = [...sessions.values()]
    .filter((session) => (
      !session.deleted_at
      && session.owner_tenant_id === input.user.tenantId
      && session.owner_object_id === input.user.objectId
      && (cursor === undefined || session.updated_at.getTime() < cursor)
      && (!search || session.title.toLocaleLowerCase().includes(search))
      && (!input.semanticModelId || session.semantic_model_id === input.semanticModelId)
    ))
    .sort((left, right) => right.updated_at.getTime() - left.updated_at.getTime());

  const hasMore = matches.length > input.limit;
  const page = matches.slice(0, input.limit);
  return {
    sessions: page.map(sessionView),
    next_cursor: hasMore ? page.at(-1)?.updated_at.toISOString() ?? null : null,
  };
}

export async function getOwnedSession(user: AuthenticatedUser, id: string) {
  const session = await assertOwnedSession({ id, user });
  const sessionMessages = [...messages.values()]
    .filter((message) => message.session_id === id)
    .sort((left, right) => left.created_at.getTime() - right.created_at.getTime());
  return { ...session, messages: sessionMessages };
}

export async function renameOwnedSession(user: AuthenticatedUser, id: string, title: string) {
  await assertOwnedSession({ id, user });
  const session = sessions.get(id)!;
  session.title = title;
  session.updated_at = new Date();
  return sessionView(session);
}

export async function deleteOwnedSession(user: AuthenticatedUser, id: string) {
  await assertOwnedSession({ id, user });
  const session = sessions.get(id)!;
  session.deleted_at = new Date();
  session.updated_at = session.deleted_at;
}

export async function assertOwnedMessage(user: AuthenticatedUser, messageId: string) {
  const message = messages.get(messageId);
  if (!message) throw new NotFoundError('Message not found');
  const session = await assertOwnedSession({ id: message.session_id, user });
  return {
    id: message.id,
    session_id: message.session_id,
    correlation_id: message.correlation_id,
    semantic_model_id: session.semantic_model_id,
  };
}
