CREATE INDEX IF NOT EXISTS chat_sessions_owner_model_updated_idx
  ON chat_sessions(owner_tenant_id, owner_object_id, semantic_model_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_session_created_desc_idx
  ON chat_messages(session_id, created_at DESC);
