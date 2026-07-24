import { randomUUID } from 'node:crypto';
import { getPool } from '../postgres/pool.js';
import { ConflictError, NotFoundError } from '../../errors.js';
import type { AuthenticatedUser, NormalizedMcpResponse } from '../../types.js';

export async function ensureOwnedSession(input: { id: string; semanticModelId: string; prompt: string; user: AuthenticatedUser; correlationId: string }) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO chat_sessions(id, owner_tenant_id, owner_object_id, semantic_model_id, title) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [input.id, input.user.tenantId, input.user.objectId, input.semanticModelId, input.prompt.slice(0, 120)]);
    const current = await client.query('SELECT owner_tenant_id, owner_object_id, semantic_model_id FROM chat_sessions WHERE id=$1 FOR UPDATE', [input.id]);
    const row = current.rows[0] as { owner_tenant_id: string; owner_object_id: string; semantic_model_id: string } | undefined;
    if (!row || row.owner_tenant_id !== input.user.tenantId || row.owner_object_id !== input.user.objectId) throw new NotFoundError('Session not found');
    if (row.semantic_model_id !== input.semanticModelId) throw new ConflictError('A session cannot change its semantic model');
    await client.query(`INSERT INTO chat_messages(id, session_id, role, content, correlation_id) VALUES($1,$2,'user',$3,$4)`, [randomUUID(), input.id, input.prompt, input.correlationId]);
    await client.query('UPDATE chat_sessions SET updated_at=NOW() WHERE id=$1', [input.id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function saveAssistantMessage(sessionId: string, correlationId: string, response: NormalizedMcpResponse) {
  await getPool().query(`INSERT INTO chat_messages(id, session_id, role, content, normalized_response, correlation_id) VALUES($1,$2,'assistant',$3,$4,$5)`,
    [randomUUID(), sessionId, response.answer, JSON.stringify(response), correlationId]);
}

export async function listOwnedSessions(user: AuthenticatedUser, limit: number) {
  const result = await getPool().query(`SELECT id, semantic_model_id, title, created_at, updated_at FROM chat_sessions WHERE owner_tenant_id=$1 AND owner_object_id=$2 ORDER BY updated_at DESC LIMIT $3`, [user.tenantId, user.objectId, limit]);
  return result.rows;
}

export async function getOwnedSession(user: AuthenticatedUser, id: string) {
  const session = await getPool().query(`SELECT id, semantic_model_id, title, created_at, updated_at FROM chat_sessions WHERE id=$1 AND owner_tenant_id=$2 AND owner_object_id=$3`, [id, user.tenantId, user.objectId]);
  if (!session.rowCount) throw new NotFoundError('Session not found');
  const messages = await getPool().query(`SELECT id, role, content, normalized_response, correlation_id, created_at FROM chat_messages WHERE session_id=$1 ORDER BY created_at`, [id]);
  return { ...session.rows[0], messages: messages.rows };
}
