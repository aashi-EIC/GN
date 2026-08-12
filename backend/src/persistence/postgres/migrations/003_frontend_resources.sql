ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS chat_sessions_active_owner_updated_idx
  ON chat_sessions(owner_tenant_id, owner_object_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  owner_tenant_id TEXT NOT NULL,
  owner_object_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('helpful', 'not_helpful')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, owner_tenant_id, owner_object_id)
);

CREATE TABLE IF NOT EXISTS issue_reports (
  id UUID PRIMARY KEY,
  owner_tenant_id TEXT NOT NULL,
  owner_object_id TEXT NOT NULL,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  semantic_model_id TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS issue_reports_owner_created_idx
  ON issue_reports(owner_tenant_id, owner_object_id, created_at DESC);
