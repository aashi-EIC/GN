# Nielsen Conversational BI — Node BFF

This service is the only backend called by React. All application endpoints are under `/api/v1`; the browser never calls the external MCP Host directly.

## Security and trust boundaries

- Every application route validates the inbound Microsoft Entra access token signature, issuer, audience and lifetime.
- Optional delegated scope and role allowlists are enforced from environment configuration.
- Session ownership uses the validated `tid` and `oid` claims. Browser-supplied email or owner values are never trusted.
- A session's semantic model is immutable and enforced in a PostgreSQL transaction.
- MCP authentication is selected by `MCP_AUTH_MODE`: `api-key` for current testing or `obo` for production.
- External response content is size-limited, runtime-validated and rejected when it contains active/script content.
- Logs redact authorization tokens, API keys, secrets and passwords.

## Endpoints

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| GET | `/api/v1/health/live` | No | Process liveness |
| GET | `/api/v1/health/ready` | No | Configuration, PostgreSQL and optional Redis readiness |
| GET | `/api/v1/me` | Entra | Current user, scopes, roles and effective permissions |
| GET | `/api/v1/bootstrap` | Entra | User, accessible models, feature flags and UI limits |
| GET | `/api/v1/semantic-models` | Entra | Accessible semantic-model catalogue |
| GET | `/api/v1/semantic-models/:modelId` | Entra | One accessible model |
| GET | `/api/v1/semantic-models/:modelId/prompts` | Entra | Example prompts for one model |
| POST | `/api/v1/sessions` | Entra | Create an owned session and server-generated UUID |
| GET | `/api/v1/sessions?limit=10&cursor=&search=&semantic_model_id=` | Entra | Search and paginate the caller's sessions |
| GET | `/api/v1/sessions/:sessionId` | Entra | Read one owned session and its messages |
| PATCH | `/api/v1/sessions/:sessionId` | Entra | Rename one owned session |
| DELETE | `/api/v1/sessions/:sessionId` | Entra | Soft-delete one owned session |
| POST | `/api/v1/chat` | Entra | Send a prompt through the BFF to MCP |
| POST | `/api/v1/chat/:requestId/cancel` | Entra | Cancel an active owned prompt request |
| POST | `/api/v1/messages/:messageId/feedback` | Entra | Create or update message feedback |
| DELETE | `/api/v1/messages/:messageId/feedback` | Entra | Remove message feedback |
| POST | `/api/v1/issues` | Entra | Persist an issue report with ownership context |

The stable BFF request is:

```json
{
  "session_id": "browser-generated UUID",
  "semantic_model_id": "value selected from client-provided model configuration",
  "prompt": "user text"
}
```

No user email, owner ID, API key or downstream token is accepted in the body.

## Frontend configuration

`SEMANTIC_MODELS_JSON` is the temporary client-owned catalogue source until a dedicated configuration service is available. The BFF validates it at startup and filters models by the caller's Entra roles. An empty array keeps the current frontend fallback catalogue available during integration.

Example structure using placeholders only:

```json
[
  {
    "id": "client-provided-model-id",
    "name": "Client model name",
    "short": "CM",
    "description": "Client-provided description",
    "examplePrompts": ["Client-provided example prompt"],
    "supportedVisualizations": ["kpi", "bar", "line", "table"],
    "enabled": true,
    "allowedRoles": ["ClientConfiguredAnalystRole"]
  }
]
```

`FEATURE_FLAGS_JSON`, `MAX_PROMPT_LENGTH` and `MAX_HISTORY_ITEMS` control non-secret UI behavior returned by `/api/v1/bootstrap`. Secrets are never returned by configuration endpoints.

## Setup

1. Copy `.env.example` to `.env`.
2. Insert only values supplied by the client/platform owners. Blank client-specific values are intentional.
3. Install and compile:

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
```

4. Create the PostgreSQL schema:

```powershell
npm.cmd run migrate
```

5. Start development mode:

```powershell
npm.cmd run dev
```

Production uses `npm.cmd run build`, `npm.cmd run migrate:prod`, then `npm.cmd start`.

## API-key testing mode

Set `MCP_AUTH_MODE=api-key`, then supply the client-provided `MCP_API_KEY_HEADER` and `MCP_API_KEY_VALUE`. The header name is not assumed; `Authorization` is supported when that is the agreed external contract.

## OBO production mode

Set `MCP_AUTH_MODE=obo` and configure the confidential-client ID/secret and downstream scope. `OBO_TENANT_ID` may be left blank when it is the same as `ENTRA_TENANT_ID`, which supports the one-app-registration POC setup.

The inbound BFF token is exchanged using MSAL's on-behalf-of flow. Secrets belong in a secret manager at deployment time, not a committed `.env` file.

See [docs/entra-obo-one-registration.md](docs/entra-obo-one-registration.md) for the one-registration workflow and the exact client values still required.

## Client-specific MCP contract

No external endpoint path, payload fields, response fields, scopes, model IDs, RLS claims or Entra identifiers are hard-coded.

- `mcpRequestAdapter.ts` maps the stable BFF request to field paths named by `MCP_REQUEST_*` variables.
- `mcpResponseAdapter.ts` validates a JSON-object response and resolves client-provided `MCP_RESPONSE_*_PATH` values.
- `httpMcpHostClient.ts` owns the external URL, HTTP behavior, timeouts, cancellation, response size limit and explicitly enabled safe retries.
- `authenticationProvider.ts` owns API-key and OBO authentication.

Safe retries are disabled by default because the unknown MCP POST operation cannot be assumed idempotent. Enable them only after the MCP owner confirms that replaying a correlation-ID-identical request is safe.

## Redis

Redis is optional. When `REDIS_URL` is absent, rate limiting uses process-local memory. Configure Redis for horizontally scaled production deployments so all BFF instances share rate-limit state.
