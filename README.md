# Conversational BI

Internal pilot build. Not the final production release.

React/Vite frontend with a Node.js Express backend-for-frontend (BFF). The BFF validates requests, manages sessions, and connects the UI to the MCP analytics service.

This build has no Entra login. Everyone reaching the BFF shares one workspace identity, even though conversations have separate sessions. Restrict both UI and API access through a company gateway, VPN, or private network.

## Repository

- `frontend/`: React application, response rendering, and browser history.
- `backend/`: Express API, session management, and MCP integration.
- `docker-compose.yml`: Local two-container deployment.
- `package.json`: Shared workspace scripts.
- `docs/`: Presentation documents, images, and document-generation sources.

The frontend and backend use separate container images. In Kubernetes, the Ingress routes `/api` to the BFF and everything else to the frontend. The browser uses `/api/v1`, not an internal Kubernetes service address.

## Local setup

Requires Node.js 22 LTS or newer, npm 10 or newer, and access to MCP. Docker Compose is optional for local container testing.

Run from the repository root:

```powershell
npm.cmd ci
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

Set `MCP_BASE_URL` in `backend/.env` to the MCP Host origin. Check the endpoint path, request-field mappings, model IDs, and authentication mode against the deployed Host's `/chat` contract. Example values are defaults, not credentials.

Start the BFF:

```powershell
npm.cmd run dev --workspace backend
```

In another terminal, start the frontend:

```powershell
npm.cmd run dev --workspace frontend
```

Open <http://localhost:5173>. The BFF runs at <http://localhost:3000>.

## Configuration

`frontend/.env.example` covers the public API URL and request timeout. `backend/.env.example` covers server settings, CORS, models, rate limits, and MCP.

### MCP connection

- Set `MCP_BASE_URL` and `MCP_ENDPOINT_PATH` for the deployed Host.
- Use `MCP_REQUEST_*` to map request fields. The sample mapping sends `message`, `user_id`, and `semantic_model_id`, then adds `session_id` after MCP creates one.
- Use `MCP_MODEL_ID_MAP_JSON` if UI and MCP model IDs differ.
- Use `MCP_REQUEST_STATIC_FIELDS_JSON` only for additional server-controlled fields. Do not put browser-supplied identity or model values there.
- Set `MCP_AUTH_MODE=none` for an unauthenticated server-to-server endpoint. For API-key authentication, set `MCP_AUTH_MODE=api-key`, `MCP_API_KEY_HEADER`, and `MCP_API_KEY_VALUE`.
- Keep API keys out of frontend variables and never commit a populated `.env` file.

Populate `SEMANTIC_MODELS_JSON` with approved models before deployment. Leaving it as `[]` disables the server-side model allowlist. Match these bundled UI IDs: `schedule_completeness_tsg` and `mapping_stats_vod`. Adding a model to Power BI does not add it to the UI picker.

### Streaming (opt-in testing)

Normal chat remains the default: `/api/v1/chat` calls MCP `/chat`. Streaming uses a separate `/api/v1/chat/stream` route and MCP `/chat/stream`; it does not replace or replay the normal request.

To test streaming, set `CHAT_STREAMING_ENABLED=true` in the BFF and `VITE_CHAT_STREAMING_ENABLED=true` in the frontend. Restart both development servers. For containers, supply the frontend flag at runtime; Compose accepts it from the shell or root `.env`. Both flags default to false. An opted-in UI checks `/api/v1/chat/capabilities` before choosing a transport; a disabled or older BFF keeps new requests on normal chat. Once a streaming request is submitted, failure never triggers an automatic `/chat` retry.

The adapter consumes upstream `status`, `token`, and `done` SSE events. Tokens are forwarded as `text_delta` events and displayed progressively using the existing LLM-only Markdown/table renderer. Partial table rows and unfinished code blocks wait until they can be rendered safely. Live previews stay in memory; only a validated completion saves the final answer. Tool results and other pipeline payloads are never rendered as answer text. Session metadata is saved when `session_ready` arrives, including if the stream subsequently fails. Regeneration hides the old answer and keeps later turns in place.

Preview updates are batched every 50 ms and subscribed to by the active response, not the entire workspace. Large bursts are spread over a catch-up window of up to 150 ms; completion still displays the full answer immediately. The original analyzing bars and text shimmer remain until readable content arrives, then give way to small writing dots. Completed content stays still. Reduced-motion settings disable transition effects; the requested loading bars and text shimmer remain animated.

Tables show complete rows and an actual received-row count, without guessing the final total. Search, sorting, pagination, copy and export become available after validated completion. Completed tables are reused while later text arrives. Scrolling up pauses auto-follow, including at completion; **Jump to latest** resumes it. Normal streaming follows new content with frame-based easing, without re-rendering the workspace for every token.

If a stream fails after text arrives, the safe partial preview stays in memory with an explicit incomplete/not-saved notice and disabled table exports. It is never saved as the final answer and disappears on reload. A failed regeneration restores the original answer with an inline notice. No failed stream is automatically replayed through normal chat.

Stream requests follow the Host format: `user_id`, `email`, `bearer_token`, `message`, `semantic_model_id`, and optional `session_id`. `user_id` remains the anonymous browser UUID. `MCP_STREAM_EMAIL` defaults to `test@example.com` as pilot metadata, not a verified identity. The adapter sends an empty bearer token by default. If the Host later requires a real token, arrange an approved server-side credential flow; never place it in frontend configuration or browser storage. Existing server-controlled static fields can supply optional Host fields. Model-ID mappings remain applicable.

The BFF sends heartbeat comments, disables caching, requests no proxy buffering, and aborts upstream work on client disconnect or timeout. Verify the actual Kubernetes ingress streams immediately and has sufficient idle/read timeouts; application headers alone cannot guarantee proxy behavior. Cancellation and sessions remain process-local, as in normal chat.

Before enabling for internal users, verify real analytics prompts, follow-ups, both semantic models, interrupted streams, regeneration, tables, mobile layout, and ingress behavior. A greeting probe confirmed the live SSE event shape, not Power BI analytics permissions. Rollback: disable either flag for new requests and keep `/chat` deployed. Reload older UI tabs after rollout.

### Browser identity and sessions

The frontend creates an anonymous UUID per browser profile and sends it with each chat request. The BFF forwards it as MCP `user_id`. Each conversation also has its own local UUID.

The first prompt omits MCP `session_id`. MCP creates the session, the BFF returns `mcp_session_id`, and the frontend saves it for follow-up prompts. MCP session status and message count are returned as validated metadata. A terminal status (`expired`, `closed`, `terminated`, `invalid`, or `inactive`) clears the saved MCP session reference so the next prompt starts a new session. Requests are not replayed automatically.

These IDs are not authentication. Any caller reaching the BFF uses the shared workspace identity and can access its backend session history. The browser UUID only separates anonymous rate-limit buckets; older clients fall back to their network address. Health checks are not rate-limited.

Refresh does not change the browser UUID while local storage is available. Clearing site data, changing browser profiles, or starting a new private-browsing session can create a new UUID. There is no verified-user history recovery.

### UI behavior

Display name and Settings preferences save automatically in the current browser. They survive backend restarts but do not carry over to another browser. Clearing site data removes them. Settings shows a warning if preferences cannot be saved.

The loading indicator stays visible while analysis is pending and respects reduced-motion preferences. Failed requests are not retried automatically; use **Try again**.

Answers render from LLM text only. Markdown tables and narrowly recognized uniform data lists become tables; raw tool-result tables are not appended. Chart directives and named chart-array sections are suppressed for this release. Keep the visualization module: response tables still use it.

Generated DAX and raw diagnostics are available when debug access is enabled. In production, set `"debugMode":true` in `FEATURE_FLAGS_JSON` to return diagnostics. The browser setting controls visibility only, not access.

## History and storage

- Conversations and MCP session references: browser localStorage. Survive refresh, but not cleared site data or a different browser profile.
- Display name, theme, and Settings: browser localStorage. These are local preferences, not an authenticated profile.
- BFF sessions, messages, feedback, issue records, and settings API records: backend process memory. Lost on restart and not shared across replicas; no durable database or external ticket integration.
- MCP history: retained by the MCP Host under its own policy. The UI does not fetch a remote history endpoint yet.

Tabs using the same origin and browser profile synchronize history through storage events and refresh it on focus. Different hostnames, ports, protocols, profiles, or devices do not share storage. Use the same exact URL in every tab.

Existing history is kept as a read-only baseline. New conversations and field/message changes use versioned localStorage keys, avoiding whole-history overwrites. Independent changes are preserved. Concurrent edits to the same field or message use the last stored value. Deletion markers stop stale tabs and late responses from restoring removed chats or messages.

The selected chat, draft, and generation indicator remain local to each tab. Close older application tabs after deploying this change; older builds still save whole-list snapshots.

Sidebar deletion and renaming affect the browser copy only, not BFF or MCP history. Regeneration replaces the selected answer and preserves later messages, but sends another prompt to the current MCP session; it does not rewind the Host's context.

Storage writes are best-effort. Blocked or full storage does not stop chat or show a chat-storage warning. The current tab keeps its in-memory state, but unsaved history may disappear on refresh or close. The planned remote storage endpoint does not provide recovery until it is connected. Copy important answers before clearing site data.

Feedback buttons update page state only. **Save issue** acknowledges the form without saving it or calling the BFF issue endpoint. Do not use either as a reporting or support channel during the pilot.

## Docker Compose

Configure `backend/.env`, then run:

```powershell
docker compose up --build -d
docker compose ps
```

Compose reads `backend/.env`. The frontend API URL and timeout come from `docker-compose.yml`; `frontend/.env` is only needed for Vite development. Frontend port: 5173. Backend port: 3000.

To stop:

```powershell
docker compose down
```

## Deployment images

Build from the repository root:

```powershell
docker build -f frontend/Dockerfile.frontend -t docker-registry.prod.gracenote.com/gn-bia/conv-bi-frontend-no-entra:v1.0.0 .
docker build -f backend/Dockerfile.backend -t docker-registry.prod.gracenote.com/gn-bia/conv-bi-backend-no-entra:v1.0.0 .
```

The frontend runs unprivileged Nginx on port 8080. The backend runs as the non-root Node user on port 3000. Both images include health checks. Update the image tags to the agreed release version before pushing.

## Internal Kubernetes deployment

Manifests and the deployed URL are managed outside this repository. Compose is for local testing; do not use its localhost API URL for remote users.

- Frontend: port 8080, runtime `VITE_API_BASE_URL=/api/v1`.
- Backend: port 3000, `NODE_ENV=production`.
- Ingress: route `/api` to the BFF without stripping the prefix; send other paths to the frontend. Frontend Nginx does not proxy API requests.
- Access: restrict both UI and API to the internal audience. Do not expose the BFF directly. This build cannot separate users with different data entitlements.
- TLS and CORS: use HTTPS and set `CORS_ALLOWED_ORIGINS` to the exact UI origin.
- Timeouts: allow the 300-second MCP request plus overhead. The default browser timeout is 315 seconds.
- Replicas: use one backend for this pilot. Sessions, cancellation, and rate limits are process-local. Replace in-memory rate limiting with a shared store before scaling.
- Probes: liveness `/api/v1/health/live`; readiness `/api/v1/health/ready`.
- Shutdown: in-flight requests have at most 10 seconds to finish after termination. Roll out when idle.
- Resources: set requests/limits and monitor memory, restarts, error rates, and request duration. Session/message repositories have no retention cap or cleanup policy.

This deployment does not provide durable backend history or high availability.

### Before rollout

- Verify access restrictions cover both UI and API.
- Check MCP origin, path, request mappings, authentication, and approved model IDs. Populate the server model allowlist.
- Store credentials in deployment Secrets. Browser runtime configuration is public.
- Keep automatic analytical retries disabled unless MCP guarantees safe replay.
- Decide whether raw debug access is appropriate for the internal audience.
- Resolve or assess dependency audit findings before approving the release.

Readiness checks only verify that required configuration is present. They do not contact MCP or validate credentials, model permissions, or request/response contracts.

### After rollout

Use the actual internal URL from a remote user machine:

1. Check both health probes and confirm chat requests reach `/api/v1/chat`, not localhost.
2. Ask a question in each approved model, then a follow-up in the same chat.
3. Check tables, Findings & Insights, and generated DAX if enabled. Tool results must not appear as extra answer tables.
4. Regenerate an earlier answer. Later messages must remain, the loading row must align and animate, and the composer must stay blocked until completion.
5. Check recoverable errors and confirm failed requests are not replayed automatically.
6. Refresh and reopen a chat. Confirm browser UUID and MCP session references remain available. Check history synchronization across two tabs, including deletion.
7. Check logs for failures and accidental collection of prompts, results, or credentials. Confirm rollback image tags before switching traffic.

## Quality checks

```powershell
npm.cmd run check
npm.cmd audit --omit=dev
```

`check` runs ESLint, TypeScript, Prettier, and production builds for both applications. `audit` checks runtime dependencies. Neither command tests live MCP integration or Kubernetes.

This distribution has no checked-in automated test files. Keep `frontend/index.html`, both environment examples, the lockfile, runtime-config files, and build/deployment configuration. Documents and test/scratch artifacts are excluded from Docker build contexts.
