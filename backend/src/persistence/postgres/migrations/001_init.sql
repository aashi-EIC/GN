CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY,
  owner_tenant_id TEXT NOT NULL,
  owner_object_id TEXT NOT NULL,
  semantic_model_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_sessions_semantic_model_not_blank CHECK (length(trim(semantic_model_id)) > 0)
);

CREATE INDEX IF NOT EXISTS chat_sessions_owner_updated_idx
  ON chat_sessions(owner_tenant_id, owner_object_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  normalized_response JSONB,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx ON chat_messages(session_id, created_at);
