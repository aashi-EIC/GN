# Conversational BI - Node BFF

The BFF is the only backend called by the React application. All application endpoints are under `/api/v1`; the browser never calls the external MCP host directly.

## Security boundary

- Protected routes validate the Microsoft Entra access-token signature, issuer, audience and lifetime.
- Optional delegated-scope and app-role allowlists are configured through the environment.
- Ownership uses validated `tid` and `oid` claims; browser-supplied owner details are not trusted.
- A session's semantic model is immutable and enforced by the repository layer.
- MCP authentication supports `none` for an approved demo endpoint, `api-key` for protected testing, and OBO for production.
- External response content is size-limited, runtime-validated and rejected when it contains active content.
- Logs redact authorization tokens, API keys, secrets and passwords.

## Endpoints

| Method | Path                                       | Authentication | Purpose                                            |
| ------ | ------------------------------------------ | -------------- | -------------------------------------------------- |
| GET    | `/api/v1/health/live`                      | No             | Process liveness                                   |
| GET    | `/api/v1/health/ready`                     | No             | Configuration and Redis readiness                  |
| GET    | `/api/v1/me`                               | Entra          | Current user and effective permissions             |
| GET    | `/api/v1/bootstrap`                        | Entra          | User, model catalogue, feature flags and UI limits |
| GET    | `/api/v1/settings`                         | Entra          | Read the caller's UI settings                      |
| PUT    | `/api/v1/settings`                         | Entra          | Update the caller's UI settings                    |
| GET    | `/api/v1/semantic-models`                  | Entra          | Accessible model catalogue                         |
| GET    | `/api/v1/semantic-models/:modelId`         | Entra          | One accessible model                               |
| GET    | `/api/v1/semantic-models/:modelId/prompts` | Entra          | Suggested prompts for one model                    |
| POST   | `/api/v1/sessions`                         | Entra          | Create an owned session                            |
| GET    | `/api/v1/sessions`                         | Entra          | Search and paginate owned sessions                 |
| GET    | `/api/v1/sessions/:sessionId`              | Entra          | Read an owned session and messages                 |
| PATCH  | `/api/v1/sessions/:sessionId`              | Entra          | Rename an owned session                            |
| DELETE | `/api/v1/sessions/:sessionId`              | Entra          | Delete an owned session                            |
| POST   | `/api/v1/chat`                             | Entra          | Send a prompt through the BFF to MCP               |
| POST   | `/api/v1/chat/:requestId/cancel`           | Entra          | Cancel an active owned request                     |
| POST   | `/api/v1/messages/:messageId/feedback`     | Entra          | Save message feedback                              |
| DELETE | `/api/v1/messages/:messageId/feedback`     | Entra          | Remove message feedback                            |
| POST   | `/api/v1/issues`                           | Entra          | Save an issue report with ownership context        |

The stable chat request is:

```json
{
  "session_id": "session UUID",
  "semantic_model_id": "configured model ID",
  "prompt": "user text"
}
```

No email address, owner ID, API key or downstream token is accepted in the request body.

## Configuration

Copy `.env.example` to `.env` and fill the values supplied by the client/platform owners. Client identifiers, secrets and endpoint URLs are intentionally absent from source control.

`SEMANTIC_MODELS_JSON` is the temporary client-owned catalogue source until a configuration service is available. The BFF validates it at startup and filters models using the caller's Entra roles. `FEATURE_FLAGS_JSON`, `MAX_PROMPT_LENGTH` and `MAX_HISTORY_ITEMS` control non-secret behavior returned by `/api/v1/bootstrap`.

### MCP authentication

- `MCP_AUTH_MODE=none`: only for an explicitly unprotected non-production endpoint.
- `MCP_AUTH_MODE=api-key`: set the agreed `MCP_API_KEY_HEADER` and `MCP_API_KEY_VALUE`.
- `MCP_AUTH_MODE=obo`: configure the confidential-client credentials and downstream scope. Secrets must come from the deployment secret manager.

The MCP request adapter maps the stable BFF contract to field names configured with `MCP_REQUEST_*`. The response adapter validates the MCP JSON envelope and rejects unsafe content. Safe retries are disabled unless the MCP owner confirms that replaying an identical correlation ID is idempotent.

## Development

From the repository root:

```powershell
npm.cmd ci
npm.cmd run typecheck --workspace backend
npm.cmd run build --workspace backend
npm.cmd run dev --workspace backend
```

Production runs the compiled service with `npm.cmd start --workspace backend`.

## Temporary persistence

Sessions, messages, user settings, feedback and issue reports currently use process-local repositories. Data is lost on restart and is not shared across BFF instances. Replace these repository implementations with client-owned persistent storage before horizontal production scaling; the HTTP API does not need to change.

Redis is optional. Without `REDIS_URL`, rate limiting is process-local. Configure Redis when multiple BFF instances must share rate-limit state.
