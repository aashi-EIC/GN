import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../errors.js';
import type { AuthenticatedUser } from '../../types.js';
import { getPool } from '../postgres/pool.js';
import { assertOwnedMessage, assertOwnedSession } from './sessionRepository.js';

export async function saveMessageFeedback(input: {
  messageId: string;
  rating: 'helpful' | 'not_helpful';
  reason?: string;
  user: AuthenticatedUser;
}) {
  await assertOwnedMessage(input.user, input.messageId);
  const result = await getPool().query(
    `INSERT INTO message_feedback(
       id, message_id, owner_tenant_id, owner_object_id, rating, reason
     ) VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(message_id, owner_tenant_id, owner_object_id)
     DO UPDATE SET rating=EXCLUDED.rating, reason=EXCLUDED.reason, updated_at=NOW()
     RETURNING id, message_id, rating, reason, created_at, updated_at`,
    [
      randomUUID(), input.messageId, input.user.tenantId, input.user.objectId,
      input.rating, input.reason ?? null,
    ],
  );
  return result.rows[0];
}

export async function deleteMessageFeedback(user: AuthenticatedUser, messageId: string) {
  await assertOwnedMessage(user, messageId);
  await getPool().query(
    `DELETE FROM message_feedback
      WHERE message_id=$1 AND owner_tenant_id=$2 AND owner_object_id=$3`,
    [messageId, user.tenantId, user.objectId],
  );
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
      throw new ConflictError('The issue semantic model does not match the selected session');
    }
  }
  if (input.messageId) {
    const message = await assertOwnedMessage(input.user, input.messageId);
    if (input.sessionId && message.session_id !== input.sessionId) {
      throw new ConflictError('The selected message does not belong to the selected session');
    }
    if (message.semantic_model_id !== input.semanticModelId) {
      throw new ConflictError('The issue semantic model does not match the selected message');
    }
  }

  const id = randomUUID();
  const result = await getPool().query(
    `INSERT INTO issue_reports(
       id, owner_tenant_id, owner_object_id, session_id, message_id,
       semantic_model_id, category, severity, description, correlation_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, session_id, message_id, semantic_model_id, category, severity, description, created_at`,
    [
      id, input.user.tenantId, input.user.objectId, input.sessionId ?? null,
      input.messageId ?? null, input.semanticModelId, input.category, input.severity,
      input.description, input.correlationId,
    ],
  );
  return result.rows[0];
}
