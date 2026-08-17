# API Requirements Analysis: Migrating Local Storage to Backend APIs

To make the frontend completely dependent on backend APIs instead of relying on `localStorage` to store conversational history, settings, user preferences, and audit/debug logs, we need to extend both the database schema and backend API endpoints.

---

## 1. Existing Backend Endpoints (To Be Integrated in Frontend)

The backend already has the following endpoints and database support, which the frontend currently **does not call** (the frontend currently loads all conversations and messages from `localStorage`):

### Chat Session Management

- **`GET /api/v1/sessions`**
  - **Description**: Retrieves the list of chat sessions owned by the authenticated user.
  - **Inbound Authorization**: Required (MSAL Bearer Token).
  - **Response Payload**:
    ```json
    {
      "sessions": [
        {
          "id": "uuid",
          "semantic_model_id": "string",
          "title": "string",
          "created_at": "timestamp",
          "updated_at": "timestamp"
        }
      ]
    }
    ```
- **`GET /api/v1/sessions/:sessionId`**
  - **Description**: Retrieves the details of a specific chat session and all its associated messages.
  - **Inbound Authorization**: Required (MSAL Bearer Token).
  - **Response Payload**:
    ```json
    {
      "id": "uuid",
      "semantic_model_id": "string",
      "title": "string",
      "created_at": "timestamp",
      "updated_at": "timestamp",
      "messages": [
        {
          "id": "uuid",
          "role": "user | assistant",
          "content": "string",
          "normalized_response": {},
          "correlation_id": "string",
          "created_at": "timestamp"
        }
      ]
    }
    ```

---

## 2. New Backend Endpoints Needed (To Be Created)

To replace all frontend local storage keys, we need to create the following new API endpoints:

### A. Extended Chat Session Management

To manage and prune chat histories:

- **`PATCH /api/v1/sessions/:sessionId`**
  - **Description**: Updates a session's metadata (e.g., renaming the session title).
  - **Request Body**: `{ "title": "New Session Name" }`
- **`DELETE /api/v1/sessions/:sessionId`**
  - **Description**: Deletes a specific chat session (cascades and deletes its messages).
- **`DELETE /api/v1/sessions`**
  - **Description**: Clears/deletes all chat sessions owned by the authenticated user.

### B. User Settings & Preferences

To replace `conversational-bi-settings` and `conversational-bi-theme`:

- **`GET /api/v1/settings`**
  - **Description**: Retrieves the current user's settings and theme preferences.
  - **Response Payload**:
    ```json
    {
      "displayName": "string",
      "region": "Global | string",
      "density": "comfortable | compact | spacious",
      "keepDebugOpen": boolean,
      "theme": "light | dark",
      "tourSeen": boolean
    }
    ```
- **`PUT /api/v1/settings`**
  - **Description**: Updates the current user's settings and preferences.
  - **Request Body**: (Same structure as GET response)

### C. Message Feedback

To replace `conversational-bi-feedback`:

- **`POST /api/v1/feedback`**
  - **Description**: Submits or updates feedback (thumbs-up/thumbs-down, comments) on an assistant message.
  - **Request Body**:
    ```json
    {
      "message_id": "uuid",
      "value": "like | dislike | none",
      "comment": "string"
    }
    ```

### D. Bug / Issue Reports

To replace `conversational-bi-issues`:

- **`POST /api/v1/issues`**
  - **Description**: Submits a new bug report, including log data and system state.
  - **Request Body**:
    ```json
    {
      "title": "string",
      "description": "string",
      "debug_context": {}
    }
    ```

---

## 3. Database Schema Extensions (PostgreSQL)

To support the new endpoints above, we'll need to deploy a database migration (e.g., `002_user_data.sql`):

```sql
-- 1. Table for User Settings & Preferences
CREATE TABLE IF NOT EXISTS user_settings (
  tenant_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  region TEXT DEFAULT 'Global',
  density TEXT DEFAULT 'comfortable',
  keep_debug_open BOOLEAN DEFAULT FALSE,
  theme TEXT DEFAULT 'light',
  tour_seen BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, object_id)
);

-- 2. Table for Message Feedback
CREATE TABLE IF NOT EXISTS message_feedback (
  message_id UUID PRIMARY KEY REFERENCES chat_messages(id) ON DELETE CASCADE,
  owner_tenant_id TEXT NOT NULL,
  owner_object_id TEXT NOT NULL,
  value TEXT NOT NULL CHECK (value IN ('like', 'dislike', 'none')),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Table for Reported Issues
CREATE TABLE IF NOT EXISTS issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id TEXT NOT NULL,
  owner_object_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  debug_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
