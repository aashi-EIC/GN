import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../../errors.js';
import type { AuthenticatedUser, NormalizedMcpResponse } from '../../types.js';
import { getPool } from '../postgres/pool.js';

type SessionOwnerInput = {
  id: string;
  user: AuthenticatedUser;
};

async function assertOwnedSession({ id, user }: SessionOwnerInput) {
  const result = await getPool().query(
    `SELECT id, semantic_model_id, title, created_at, updated_at
       FROM chat_sessions
      WHERE id=$1 AND owner_tenant_id=$2 AND owner_object_id=$3 AND deleted_at IS NULL`,
    [id, user.tenantId, user.objectId],
  );
  if (!result.rowCount) throw new NotFoundError('Session not found');
  return result.rows[0] as {
    id: string;
    semantic_model_id: string;
    title: string;
    created_at: Date;
    updated_at: Date;
  };
}

export async function createOwnedSession(input: {
  semanticModelId: string;
  title: string;
  user: AuthenticatedUser;
}) {
  const id = randomUUID();
  const result = await getPool().query(
    `INSERT INTO chat_sessions(id, owner_tenant_id, owner_object_id, semantic_model_id, title)
     VALUES($1,$2,$3,$4,$5)
     RETURNING id, semantic_model_id, title, created_at, updated_at`,
    [id, input.user.tenantId, input.user.objectId, input.semanticModelId, input.title],
  );
  return result.rows[0];
}

export async function ensureOwnedSession(input: {
  id: string;
  semanticModelId: string;
  prompt: string;
  user: AuthenticatedUser;
  correlationId: string;
}) {
  const client = await getPool().connect();
  const messageId = randomUUID();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO chat_sessions(id, owner_tenant_id, owner_object_id, semantic_model_id, title)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [input.id, input.user.tenantId, input.user.objectId, input.semanticModelId, input.prompt.slice(0, 120)],
    );
    const current = await client.query(
      `SELECT owner_tenant_id, owner_object_id, semantic_model_id
         FROM chat_sessions WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [input.id],
    );
    const row = current.rows[0] as {
      owner_tenant_id: string;
      owner_object_id: string;
      semantic_model_id: string;
    } | undefined;
    if (!row || row.owner_tenant_id !== input.user.tenantId || row.owner_object_id !== input.user.objectId) {
      throw new NotFoundError('Session not found');
    }
    if (row.semantic_model_id !== input.semanticModelId) {
      throw new ConflictError('A session cannot change its semantic model');
    }
    await client.query(
      `INSERT INTO chat_messages(id, session_id, role, content, correlation_id)
       VALUES($1,$2,'user',$3,$4)`,
      [messageId, input.id, input.prompt, input.correlationId],
    );
    await client.query('UPDATE chat_sessions SET updated_at=NOW() WHERE id=$1', [input.id]);
    await client.query('COMMIT');
    return messageId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function saveAssistantMessage(
  sessionId: string,
  correlationId: string,
  response: NormalizedMcpResponse,
) {
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO chat_messages(id, session_id, role, content, normalized_response, correlation_id)
     VALUES($1,$2,'assistant',$3,$4,$5)`,
    [id, sessionId, response.answer, JSON.stringify(response), correlationId],
  );
  return id;
}

export async function listOwnedSessions(input: {
  user: AuthenticatedUser;
  limit: number;
  cursor?: string;
  search?: string;
  semanticModelId?: string;
}) {
  const values: unknown[] = [input.user.tenantId, input.user.objectId];
  const filters = [
    'owner_tenant_id=$1',
    'owner_object_id=$2',
    'deleted_at IS NULL',
  ];

  if (input.cursor) {
    values.push(input.cursor);
    filters.push(`updated_at < $${values.length}::timestamptz`);
  }
  if (input.search) {
    values.push(`%${input.search}%`);
    filters.push(`title ILIKE $${values.length}`);
  }
  if (input.semanticModelId) {
    values.push(input.semanticModelId);
    filters.push(`semantic_model_id = $${values.length}`);
  }

  values.push(input.limit + 1);
  const result = await getPool().query(
    `SELECT id, semantic_model_id, title, created_at, updated_at
       FROM chat_sessions
      WHERE ${filters.join(' AND ')}
      ORDER BY updated_at DESC
      LIMIT $${values.length}`,
    values,
  );
  const hasMore = result.rows.length > input.limit;
  const sessions = result.rows.slice(0, input.limit);
  const last = sessions.at(-1) as { updated_at?: Date | string } | undefined;
  return {
    sessions,
    next_cursor: hasMore && last?.updated_at
      ? new Date(last.updated_at).toISOString()
      : null,
  };
}

export async function getOwnedSession(user: AuthenticatedUser, id: string) {
  const session = await assertOwnedSession({ id, user });
  const messages = await getPool().query(
    `SELECT id, role, content, normalized_response, correlation_id, created_at
       FROM chat_messages WHERE session_id=$1 ORDER BY created_at`,
    [id],
  );
  return { ...session, messages: messages.rows };
}

export async function renameOwnedSession(user: AuthenticatedUser, id: string, title: string) {
  const result = await getPool().query(
    `UPDATE chat_sessions SET title=$1, updated_at=NOW()
      WHERE id=$2 AND owner_tenant_id=$3 AND owner_object_id=$4 AND deleted_at IS NULL
      RETURNING id, semantic_model_id, title, created_at, updated_at`,
    [title, id, user.tenantId, user.objectId],
  );
  if (!result.rowCount) throw new NotFoundError('Session not found');
  return result.rows[0];
}

export async function deleteOwnedSession(user: AuthenticatedUser, id: string) {
  const result = await getPool().query(
    `UPDATE chat_sessions SET deleted_at=NOW(), updated_at=NOW()
      WHERE id=$1 AND owner_tenant_id=$2 AND owner_object_id=$3 AND deleted_at IS NULL
      RETURNING id`,
    [id, user.tenantId, user.objectId],
  );
  if (!result.rowCount) throw new NotFoundError('Session not found');
}

export async function assertOwnedMessage(user: AuthenticatedUser, messageId: string) {
  const result = await getPool().query(
    `SELECT m.id, m.session_id, m.correlation_id, s.semantic_model_id
       FROM chat_messages m
       JOIN chat_sessions s ON s.id=m.session_id
      WHERE m.id=$1 AND s.owner_tenant_id=$2 AND s.owner_object_id=$3 AND s.deleted_at IS NULL`,
    [messageId, user.tenantId, user.objectId],
  );
  if (!result.rowCount) throw new NotFoundError('Message not found');
  return result.rows[0] as {
    id: string;
    session_id: string;
    correlation_id: string;
    semantic_model_id: string;
  };
}

export { assertOwnedSession };
