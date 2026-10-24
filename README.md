# Conversational BI

Internal pilot build. Not the final production release.

React/Vite frontend with a Node.js Express backend-for-frontend (BFF). The BFF validates requests, manages sessions, and connects the UI to the MCP analytics service.

Everyone reaching the BFF shares one workspace identity, even though conversations have separate sessions. Browser UUIDs are correlation identifiers, not authentication. Restrict both UI and API access through a company gateway, VPN, or private network.

## Delivery scope

| Area                | Current behaviour                                                             |
| ------------------- | ----------------------------------------------------------------------------- |
| Chat                | Normal and SSE transports; streaming requires both feature flags.             |
| Rendering           | LLM text and response tables; chart output is suppressed.                     |
| History and titles  | Browser-local conversations, prompt-based titles, and manual renaming.        |
| Identity and models | Shared workspace identity, browser UUIDs, and startup-loaded model catalogue. |

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

### Deployment environment files

Use `backend/.env.deployment.example` for the BFF workload and `frontend/.env.deployment.example` for the frontend workload. These profiles contain the supplied nonproduction S3/role/MCP settings, enable streaming, and target `https://conv-bi.k8s-np.cloud.gracenote.com`. Apply their key/value pairs as runtime environment variables in Kubernetes/Rancher; a file in the codebase alone does not configure the running pod. The frontend container generates `runtime-config.js` from its runtime environment.

The BFF profile uses S3 mode, reads the supplied policy key, obtains the guide path from that policy, maps TSG/VOD/CPX to their MCP IDs and sets the monthly allowance to 1,000,000 tokens. Its exact CORS origin has no trailing slash. The frontend uses `/api/v1`; the ingress must route `/api` to the BFF and all other paths to the frontend. These profiles assume that ingress routing, not a standalone frontend Nginx API proxy.

Both streaming flags are enabled. The BFF MCP timeout is 600,000 ms; the browser timeout is 700,000 ms. Configure ingress read/idle timeouts accordingly and disable SSE buffering. Raw debug diagnostics are disabled in the deployment profile; enable `debugMode` only for an approved restricted audience.

The deployment profiles contain no live API keys, AWS credentials or Power BI bearer token. The BFF service account must supply AWS source credentials permitted to assume the supplied role, which must read both S3 objects. The bearer token is empty under the current optional-token contract. If the Host later requires credentials, inject them into the BFF through Secrets, never frontend settings. Do not distribute populated local `.env` files: they may contain temporary credentials, obsolete auth settings and host-only file paths.

Keep the ordinary `.env.example` files for native development and local Compose. Root `.env` is used for Compose interpolation only, not as a Kubernetes environment source. Compose takes BFF CORS from `backend/.env`; public frontend variables can be overridden through the shell or root `.env`. No running service needs restarting merely to prepare the handover profiles. Deploying them requires workload rollouts and a real S3 access check.

`MONTHLY_TOKEN_LIMIT=1000000` sets the allowance shared by both chat modes and all models on one BFF instance. Usage is held in BFF memory, independently of browser chat history. No external usage store is required. `/api/v1/bootstrap` exposes the configured limit; `/api/v1/usage/monthly` returns the current balance using `x-browser-user-id`.

### Monthly token quota

- Calendar months reset at 00:00 UTC on the first day. Requests are charged to the month in which they were admitted. Accounting starts when the BFF starts; older local transcripts are not backfilled. Restarting or redeploying the BFF clears usage.
- Normal chat rejects new requests with HTTP 429 once reported usage reaches the allowance. Streaming returns an SSE error with code `MONTHLY_TOKEN_LIMIT_EXCEEDED`. Neither path submits that rejected request to MCP.
- MCP reports tokens after completion. Requests already in flight may cross the allowance; this is an admission limit, not an upstream hard token-spend ceiling. Parallel tabs remain supported. In-process updates are synchronous and each request settles once, avoiding lost increments or duplicate settlement within the instance.
- Every admitted attempt counts, including regeneration. Deleting, renaming, or replacing a saved response does not refund usage. Only validated MCP totals are charged; text-based estimates are never used.
- Missing or invalid usage and interrupted submitted requests mark the balance as incomplete in Settings but do not block later requests. No tokens are estimated for those attempts, so this counter can understate actual consumption. Errors before submission release the pending entry without charging tokens.
- The identity is still an anonymous browser UUID, not a verified person. Clearing or changing that ID bypasses per-person attribution. Keep the pilot restricted; the quota does not provide authentication.
- Chat requires a UUID in `x-browser-user-id` or `browser_user_id`. If both are supplied, they must match. A session ID is never used as a quota identity, so starting a new chat cannot reset usage.
- Counters are process-local and are not shared across BFF replicas. Use one BFF instance for the pilot. This is a best-effort usage allowance, not a durable billing or cost-control system. Old monthly records are removed after a seven-day retention window.

For Rancher, set `MONTHLY_TOKEN_LIMIT` on the BFF workload and run a single replica. Restart the BFF after changing its environment; doing so also resets the usage counter.

### MCP connection

- Set `MCP_BASE_URL` and `MCP_ENDPOINT_PATH` for the deployed Host.
- Use `MCP_REQUEST_*` to map request fields. The sample mapping sends `message`, `user_id`, and `semantic_model_id`, then adds `session_id` after MCP creates one.
- Use `MCP_MODEL_ID_MAP_JSON` if UI and MCP model IDs differ.
- Use `MCP_REQUEST_STATIC_FIELDS_JSON` only for additional server-controlled fields. Do not put browser-supplied identity or model values there.
- Set `MCP_AUTH_MODE=none` for an unauthenticated server-to-server endpoint. For API-key authentication, set `MCP_AUTH_MODE=api-key`, `MCP_API_KEY_HEADER`, and `MCP_API_KEY_VALUE`.
- Keep API keys out of frontend variables and never commit a populated `.env` file.

### Semantic model catalogue

The dropdown and Model Guide use a startup-loaded JSON catalogue. The BFF loads the model policy first, then its guide, and joins entries by canonical model ID. Policy registry keys such as `tsg` and `vod` are aliases; `semantic_model_id` must match the guide's `id` and the MCP contract. An explicit `MCP_MODEL_ID_MAP_JSON` mapping remains available for existing deployments.

The policy's `display_name` supplies the UI model name. The guide uses `modelGuide.tabs` and `modelGuide.models` for descriptions, overview sections, highlights and suggested prompts. A registered model without guide content is not published; an enabled, non-excluded guide model missing from the policy prevents startup rather than silently granting it access. Duplicate canonical IDs are rejected. The bundled pair publishes TSG, VOD and CPX Metrics. CPX includes the Customer Health Score overview and example prompts; `MCP_MODEL_ID_MAP_JSON` maps its catalogue ID `cpx_metrics` to MCP's `cpxm`.

For S3 deployments, upload the updated guide to the object referenced by the policy before restarting the BFF. The bundled guide does not override S3 content.

The BFF reads and validates this JSON once during startup, then serves its in-memory snapshot through `/api/v1/semantic-models`, the model-detail and prompts routes, and `/api/v1/bootstrap`. Invalid JSON, duplicate IDs, invalid fields or a catalogue with no enabled models prevent startup. All chat requests use this same model allowlist; an unknown or disabled model is rejected before MCP is called. There is no empty-catalogue bypass.

Set `SEMANTIC_MODEL_GUIDE_SOURCE=file` for local development. Empty `SEMANTIC_MODEL_POLICY_PATH` and `SEMANTIC_MODEL_GUIDE_PATH` use the paired files in `backend/config/`. To use another policy, provide both absolute paths, including read-only mounted files if needed. File mode uses the explicitly supplied local guide instead of following the policy's S3 pointer; it never contacts AWS. Updating a mounted file requires a BFF restart, not a frontend rebuild. Updating bundled files requires rebuilding the BFF image. `SEMANTIC_MODELS_JSON` is no longer used.

For S3, set these variables on the BFF workload (not the frontend):

```dotenv
SEMANTIC_MODEL_GUIDE_SOURCE=s3
SEMANTIC_MODEL_GUIDE_S3_BUCKET=q-lib
SEMANTIC_MODEL_POLICY_S3_KEY=CONVERSATIONAL_BI_FRONTEND_JSON_CONFIG/semantic_model_user_policy/semantic_model_user_policy.json
SEMANTIC_MODEL_GUIDE_S3_REGION=us-west-2
SEMANTIC_MODEL_GUIDE_ROLE_ARN=arn:aws:iam::700997598514:role/dev-team-irsa-role-nonprod
SEMANTIC_MODEL_GUIDE_STS_REGION=us-east-1
SEMANTIC_MODEL_GUIDE_TIMEOUT_MS=30000
SEMANTIC_MODEL_GUIDE_EXCLUDED_IDS=
```

The Node.js AWS SDK resolves source credentials from the workload identity, calls STS `AssumeRole` once, then uses the temporary credentials for two S3 `GetObject` calls: policy first, followed by the object identified by `model_guide_s3_path`. That pointer must be an `s3://` object URI in the configured bucket; HTTP URLs and cross-bucket redirects are rejected. Both objects use the configured S3 region. `SEMANTIC_MODEL_POLICY_S3_KEY` replaces the earlier `SEMANTIC_MODEL_GUIDE_S3_KEY`; the guide key now comes from the policy.

The workload must be permitted to assume the configured role, and that role must be permitted to read both objects. No AWS keys belong in frontend configuration, browser storage or the image. Kubernetes service-account configuration is managed with the deployment.

The S3 reader limits each document to 1 MiB, applies one startup timeout across both reads, and closes AWS clients after loading. An unavailable object, denied access, timeout or invalid JSON prevents startup; S3 mode never silently falls back to bundled files. Logs report a safe error category, not AWS response bodies or credentials. Both sources apply `SEMANTIC_MODEL_GUIDE_EXCLUDED_IDS` (comma-separated; empty by default). Remove any earlier `cpx_metrics` exclusion when enabling CPX. A guide model can also be disabled with `"enabled":false`.

No request-time reload, polling or scheduled refresh runs. Updating the S3 object requires a BFF restart to load the new snapshot; temporary AWS credentials are not needed again while that process serves the snapshot. Restarting the BFF also resets its in-memory sessions and token usage.

The UI requests the catalogue once per page load before mounting the workspace, without showing a startup loading message. A failed load shows a retry screen without changing saved history. Refresh the page after restarting the BFF to pick up new models. The dropdown, guide text, section headings, tab labels and prompts all use API data. New model IDs require no frontend code change; legacy aliases remain supported for existing chats. Models removed from the catalogue stay readable in saved history, but follow-up, edit and regeneration requests are blocked rather than sent to another model.

The catalogue is shared by the internal pilot. Browser UUIDs do not provide verified-user model permissions. Policy users, groups, role permissions and group token limits are not applied and are never returned to the browser. The existing `MONTHLY_TOKEN_LIMIT` remains unchanged. Registering a model does not implement user authorization; keep this pilot restricted to an approved shared audience. S3 access uses the BFF's AWS identity, independently of browser identity.

#### Test model loading locally

For an offline test, set these in `backend/.env` to use the bundled pair, including the current CPX guide:

```dotenv
SEMANTIC_MODEL_GUIDE_SOURCE=file
SEMANTIC_MODEL_POLICY_PATH=
SEMANTIC_MODEL_GUIDE_PATH=
SEMANTIC_MODEL_GUIDE_EXCLUDED_IDS=
```

Start the BFF and frontend in separate terminals from the repository root:

```powershell
npm.cmd run dev --workspace backend
npm.cmd run dev --workspace frontend
```

Check `http://localhost:3000/api/v1/semantic-models` or run `Invoke-RestMethod http://localhost:3000/api/v1/semantic-models`. Expect TSG, VOD and CPX Metrics, policy display names, guide descriptions and prompts, and no user/group/role data. Open the UI at `http://localhost:5173` and check the dropdown and Model Guide. Alliance is not published because it has no guide entry.

To verify a new model, add the same new canonical ID to a local copy of both files, with full guide metadata. Stop and start the BFF, then refresh the UI; the model appears without changing frontend code. Use an ID accepted by MCP before testing chat. For failure handling, remove the policy entry for an enabled guide model or break the JSON in a local copy: the BFF must refuse startup. Keep originals unchanged. With `tsx watch`, JSON changes alone do not reload the catalogue; explicitly restart the BFF.

These Windows paths are for `npm run dev`, not Linux containers. Compose explicitly uses the paired files bundled under `/app/backend/config`, so the same `backend/.env` can be used without passing host-only file paths to the container. To test different JSON with Compose, update the paired files in `backend/config/` and rebuild the backend image, or mount both files read-only and override the two paths with their container locations. Never bake the full user policy, including personal user/group assignments, into a shared image; the bundled policy contains catalogue metadata only. S3 mode ignores these file paths.

This verifies loading and UI rendering without AWS. A real S3 test additionally needs local AWS credentials permitted to assume the role and the S3 environment values above. Do not copy workload credentials into source files or frontend variables.

### Streaming (opt-in testing)

Normal chat uses `/api/v1/chat` and MCP `/chat`. Streaming uses `/api/v1/chat/stream` and MCP `/chat/stream`; it does not replace or replay the normal request.

Open `/chat` for non-streaming responses or `/chat/stream` for streaming responses. The header labels the selected mode. URL selection is tab-local, including follow-ups, edits and regeneration; it is not saved as a shared browser preference. `/` keeps the deployment-default behaviour. Existing `/chat/{conversationId}` URLs use non-streaming mode.

For side-by-side comparison, open both URLs in separate tabs and start a new conversation in each. Browser history still synchronizes across tabs, so reusing the same saved chat also reuses its MCP session context. Use separate conversations for independent requests.

To test streaming, set `CHAT_STREAMING_ENABLED=true` in the BFF and `VITE_CHAT_STREAMING_ENABLED=true` in the frontend. Restart both development servers. For containers, supply the frontend flag at runtime; Compose accepts it from the shell or root `.env`. Both flags default to false. `/chat` always uses normal chat, even when both flags are enabled. `/chat/stream` requires both flags and a successful capability check; otherwise it shows a streaming-unavailable error without submitting an analytical request. On `/`, a failed capability check keeps new requests on normal chat. Once a streaming request is submitted, failure never triggers an automatic `/chat` retry.

The adapter consumes upstream `status`, `token`, and `done` SSE events. Before answer text appears, the existing animated loading row shows the latest recognized processing stage: understanding the question, planning, running the query, reviewing results or preparing the response. Labels are selected from a fixed allowlist of upstream stage IDs, not raw upstream messages. Repeated stage heartbeats are deduplicated; unknown stages and pipeline `blob` events never expose query, intent or tool payloads. Once tokens arrive, late processing events cannot move the indicator back from writing. Normal chat retains its generic analyzing indicator.

Tokens are forwarded as `text_delta` events and displayed progressively using the existing LLM-only Markdown/table renderer. Partial table rows and unfinished code blocks wait until they can be rendered safely. Live previews and processing labels stay in memory; only a validated completion saves the final answer. Tool results and other pipeline payloads are never rendered as answer text. Session metadata is saved when `session_ready` arrives, including if the stream subsequently fails. Regeneration hides the old answer and keeps later turns in place.

Preview updates are batched every 50 ms and subscribed to by the active response, not the entire workspace. Large bursts are spread over a catch-up window of up to 150 ms; completion still displays the full answer immediately. Analyzing bars and text shimmer remain until readable content arrives, then give way to small writing dots. A processing label rolls into its fixed-height slot once when the text changes, not on each token or repeated heartbeat. Completed content stays still. Reduced-motion settings disable other transition effects; loading bars, text shimmer and a gentler 4 px status-label roll remain animated.

Tables show complete rows and an actual received-row count, without guessing the final total. Search, sorting, pagination, copy and export become available after validated completion. Completed tables are reused while later text arrives. Scrolling up pauses auto-follow, including at completion; **Jump to latest** resumes it. Normal streaming follows new content with frame-based easing, without re-rendering the workspace for every token.

If a stream fails after text arrives, the safe partial preview stays in memory with an explicit incomplete/not-saved notice and disabled table exports. It is never saved as the final answer and disappears on reload. A failed regeneration restores the original answer with an inline notice. No failed stream is automatically replayed through normal chat.

Stream requests follow the Host format: `user_id`, `email`, `bearer_token`, `message`, `semantic_model_id`, and optional `session_id`. `user_id` remains the anonymous browser UUID. `MCP_STREAM_EMAIL` defaults to `test@example.com` as pilot metadata, not a verified identity. The adapter sends an empty bearer token by default. Credentials belong in server-side configuration, never frontend configuration or browser storage. Server-controlled static fields can supply optional Host fields. Model-ID mappings remain applicable.

The BFF sends heartbeat comments, disables caching, requests no proxy buffering, and aborts upstream work on browser disconnect or timeout. Verify the actual Kubernetes ingress streams immediately and has sufficient idle/read timeouts; application headers alone cannot guarantee proxy behavior. Cancellation and sessions remain process-local, as in normal chat.

Before enabling for internal users, verify real analytics prompts, follow-ups, both semantic models, interrupted streams, regeneration, tables, mobile layout, and ingress behavior in the target environment. Rollback: disable either flag for new requests and keep `/chat` deployed. Reload existing UI tabs after rollout.

### Browser identity and sessions

The frontend creates an anonymous UUID per browser profile and sends it with each chat request. The BFF forwards it as MCP `user_id`. Each conversation also has its own local UUID.

The first prompt omits MCP `session_id`. MCP creates the session, the BFF returns `mcp_session_id`, and the frontend saves it for follow-up prompts. MCP session status and message count are returned as validated metadata. A terminal status (`expired`, `closed`, `terminated`, `invalid`, or `inactive`) clears the saved MCP session reference so the next prompt starts a new session. Requests are not replayed automatically.

These IDs are not authentication. Any caller reaching the BFF uses the shared workspace identity and can access its backend session history. The browser UUID only separates anonymous rate-limit buckets; older clients fall back to their network address. Health checks are not rate-limited.

Refresh does not change the browser UUID while local storage is available. Clearing site data, changing browser profiles, or starting a new private-browsing session can create a new UUID. There is no verified-user history recovery.

### UI behavior

Slash commands stay in the UI: `/help` opens the selected model's guide, `/tour` opens the guided walkthrough, `/new` starts a new conversation and `/settings` opens workspace settings. They do not send analytics requests or add messages to chat history.

Display name and Settings preferences save automatically in the current browser. They survive backend restarts but do not carry over to another browser. Clearing site data removes them. Settings shows a warning if preferences cannot be saved.

The loading indicator stays visible while analysis is pending. Reduced-motion behaviour is described in the streaming section. Failed requests are not retried automatically; use **Try again**.

Answers render from LLM text only. Markdown tables and narrowly recognized uniform data lists become tables; raw tool-result tables are not appended. Chart directives and named chart-array sections are suppressed for this release. Keep the visualization module: response tables still use it.

Generated DAX and raw diagnostics are available when debug access is enabled. In production, set `"debugMode":true` in `FEATURE_FLAGS_JSON` to return diagnostics. The browser setting controls visibility only, not access.

The MCP response in debug mode preserves validated token totals and, when supplied, the `calls` breakdown (`call_label`, `prompt_tokens`, `completion_tokens`, `total_tokens`). Credentials and unknown usage fields are excluded. Invalid call details do not affect the reported aggregate totals or quota accounting. The per-call breakdown is not added to chat replies or the Settings bar.

Token usage is shown only in Settings as a monthly quota bar, with reported input/output counts and the server allowance. Settings loads the balance on open, on focus and after chat requests in that tab. The balance comes from BFF memory, not local messages, so deleting or replacing a reply cannot lower it. Pending requests and incomplete usage are labeled explicitly. No costs are estimated and no usage bar is displayed inside chat replies.

## History and storage

- Conversations and MCP session references: browser localStorage. Survive refresh, but not cleared site data or a different browser profile.
- Display name, theme, and Settings: browser localStorage. These are local preferences, not an authenticated profile.
- BFF sessions, messages, feedback, issue records, settings API records, and monthly token usage: backend process memory. Lost on restart and not shared across replicas; no durable database or external ticket integration.
- MCP session context: retained by the MCP Host under its own policy. Chat and streaming send MCP session IDs for follow-up context. The UI loads conversation history from browser storage.

Sidebar titles are generated locally from user prompts. Manual renames stay browser-local and are not replaced by later prompts. Opening a chat reads its cached messages; no remote history or title request is made.

Regeneration replaces the selected local answer and keeps later turns in place. Compatibility handling still groups previously cached empty regeneration copies and identifies missing cached answers. If an older cached conversation has no model metadata, choose its model before continuing. These safeguards read browser data only; they do not fetch or update cloud history.

Tabs using the same origin and browser profile synchronize history through storage events and refresh it on focus. Different hostnames, ports, protocols, profiles, or devices do not share storage. Use the same exact URL in every tab.

Existing history is kept as a read-only baseline. New conversations and field/message changes use versioned localStorage keys, avoiding whole-history overwrites. Independent changes are preserved. Concurrent edits to the same field or message use the last stored value. Deletion markers stop stale tabs and late responses from restoring removed chats or messages.

The selected chat, draft, and generation indicator remain local to each tab. Close older application tabs after deploying this change; older builds still save whole-list snapshots.

Sidebar deletion and renaming affect the browser copy only, not BFF or MCP history. Regeneration replaces the selected answer and preserves later messages, but sends another prompt to the current MCP session; it does not rewind the Host's context.

Storage writes are best-effort. Blocked or full storage does not stop chat or show a chat-storage warning. The current tab keeps its in-memory state, but unsaved history may disappear on refresh or close. Copy important answers before clearing site data.

Feedback buttons update page state only. **Save issue** acknowledges the form without saving it or calling the BFF issue endpoint. Do not use either as a reporting or support channel during the pilot.

## Docker Compose

Configure `backend/.env`, then run:

```powershell
docker compose up --build -d
docker compose ps
```

Compose reads `backend/.env` but overrides file-mode model paths with `/app/backend/config/semantic-model-user-policy.json` and `/app/backend/config/semantic-model-guide.json`. Both files are included in the backend image. Windows host paths such as `C:/Users/...` work for native Node development only unless explicitly bind-mounted to container paths. The source selector remains controlled by `SEMANTIC_MODEL_GUIDE_SOURCE`; S3 mode still loads the policy and guide from AWS.

The frontend API URL and timeout come from `docker-compose.yml`; `frontend/.env` is only needed for Vite development. Frontend port: 5173. Backend port: 3000.

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
- Replicas: use one backend for this pilot. Sessions, cancellation, rate limits, and monthly token counters are process-local.
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
