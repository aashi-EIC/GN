# Conversational BI — manual models

Internal pilot with a React/Vite frontend and an Express backend-for-frontend (BFF). It supports normal chat, SSE streaming, response tables, browser history and a manually maintained Model Guide.

This build has no user authentication. Browser UUIDs identify a browser, not a verified person. Restrict both the website and API through an internal gateway, VPN or private network.

## Local setup

Use Node.js 22 LTS or newer and npm 10 or newer. Run from the repository root:

```powershell
npm.cmd ci
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Copy environment files only for a fresh checkout; keep existing local settings. Set `MCP_BASE_URL` in `backend/.env` and check the request-field mappings against the deployed MCP contract.

Start each workspace in its own terminal:

```powershell
npm.cmd run dev --workspace backend
npm.cmd run dev --workspace frontend
```

Open <http://localhost:5173>. The BFF listens on <http://localhost:3000>.

## Models

The model list is hardcoded in `backend/src/config/semanticModels.ts`. It includes TSG, VOD and CPX, with their IDs, display names and compact labels. No model-list environment variable or guide JSON file is required.

| Model                     | Catalogue ID                | MCP ID          |
| ------------------------- | --------------------------- | --------------- |
| Schedule Completeness TSG | `schedule_completeness_tsg` | `tsg`           |
| Mapping Stats VOD         | `mapping_stats_vod`         | `mapping_stats` |
| CPX Metrics               | `cpx_metrics`               | `cpxm`          |

To add or change a model:

1. Edit `backend/src/config/semanticModels.ts` to add, remove or rename a model.
2. Update `MCP_MODEL_ID_MAP_JSON` if MCP expects a different ID.
3. Add or update its guide content in `frontend/src/shared/constants/semanticModels.ts`.
4. Rebuild and deploy the affected workspaces, then refresh the browser.

Descriptions, Model Guide sections, colours and suggested prompts are hardcoded in the frontend. TSG, VOD and CPX content is included. Changing that content requires a frontend rebuild only. A model without frontend content shows a guide-not-configured message. Guide content alone never enables a model that is absent from the BFF list.

The BFF enforces the same manual list for chat requests and rejects unknown model IDs. Adding a model does not add its dataset or analytics implementation to MCP.

The UI reads IDs and display labels through `/api/v1/semantic-models`; detail and bootstrap endpoints use the same configured list. Guide text, tab labels and prompts come from frontend code, not the API. There is no automatic discovery or refresh. Removed models stay readable in saved chats but cannot receive new requests.

## Chat and streaming

| Browser path   | Transport                                                   |
| -------------- | ----------------------------------------------------------- |
| `/`            | Streaming when enabled and available; otherwise normal chat |
| `/chat`        | Normal chat                                                 |
| `/chat/stream` | Streaming; requires both flags                              |

Enable streaming with `CHAT_STREAMING_ENABLED=true` on the BFF and `VITE_CHAT_STREAMING_ENABLED=true` on the frontend. Local example files default to false; deployment profiles enable both. Docker Compose enables frontend streaming by default, so no root `.env` is needed. The BFF must still enable streaming.

Normal chat calls MCP `/chat`; streaming calls MCP `/chat/stream`. The URL selects the mode for that tab, including edits and regeneration. For independent side-by-side tests, start a different conversation in each tab. Once an analytics request is submitted, failures are never automatically retried through another transport.

Recognized processing steps appear in the animated loading row. Incoming text is batched into previews; unfinished tables and code blocks wait until safe to render. Only a validated completion saves the answer. The upstream stream has a 5 MiB default size limit; completion metadata is not limited to 100 rows or character-array entries.

Regeneration hides the previous answer while pending and keeps later turns in place. A successful regeneration replaces the selected answer. On failure, a genuine previous answer is restored; retrying an error updates that error in place. Interrupted previews stay in memory and are not saved as completed answers.

Tables support search, sorting, pagination, copy and CSV export. The rows menu matches the active theme and opens downward within the chat viewport without covering the composer; presets, typed row counts and keyboard selection are supported. Charts are suppressed. Settings shows total monthly token usage against the limit, without an input/output breakdown. Detailed token counts remain available in debug details, not in the chat body. Processing animations remain active under reduced-motion settings with smaller transitions.

Typing a character from the page background focuses the chat composer and appends it to the current draft, on both the welcome screen and saved chats. It does not submit the prompt. Other text fields, focused controls, open dialogs/menus, message editing, keyboard shortcuts and response generation keep their existing keyboard behaviour. Space, Enter and navigation keys alone do not redirect focus.

## History, sessions and limits

- Conversations, MCP session references, names and preferences use browser localStorage. Tabs on the same origin and browser profile synchronize history. Different hostnames, ports, protocols, profiles and devices do not share it.
- Titles start with a local prompt-based fallback. When an MCP session is available, the BFF can retrieve its generated title. Manual renames are preserved. Conversation messages are loaded from browser storage, not from cloud history.
- BFF sessions, messages, feedback, issue records, settings API records and token counters are process-local. Restarting the BFF clears them; replicas do not share them.
- Deleting, renaming or pinning a chat changes the browser copy, not MCP's stored history. Regeneration sends a new request within the current MCP session; it does not rewind upstream context.
- Browser persistence is best-effort. A storage failure does not block chat, but unsaved changes may be lost on refresh or close.
- Feedback controls update page state. The issue form currently acknowledges submission without persisting or sending a support report.

`MONTHLY_TOKEN_LIMIT=1000000` sets the allowance for each browser identity across models and chat modes. Calendar months reset at 00:00 UTC on the first day. Use one BFF replica for this pilot.

Requests are blocked once reported usage reaches the limit. Already-running requests may exceed it because MCP reports tokens after completion. Regeneration also counts. Missing usage marks accounting as incomplete without blocking later requests; no usage is estimated. Restarting the BFF resets the counter, and clearing the browser ID bypasses per-person attribution. This is not durable billing or a strict spending ceiling.

## Environment configuration

| File                               | Use                                    |
| ---------------------------------- | -------------------------------------- |
| `backend/.env.example`             | Native development and local Compose   |
| `frontend/.env.example`            | Vite development                       |
| `backend/.env.deployment.example`  | BFF workload environment               |
| `frontend/.env.deployment.example` | Frontend container runtime environment |

The deployment profiles target `https://conv-bi.k8s-np.cloud.gracenote.com`, enable streaming and configure the model-ID mappings. They contain no live credentials. Apply their key/value pairs to the workloads in Kubernetes/Rancher; storing the files in the repository does not configure a pod.

Keep credentials in backend Secrets, never in frontend variables or images. Frontend runtime configuration is public. The current optional-token profile sends an empty Power BI bearer token. If MCP requires authentication, configure the approved backend authentication mode and credentials.

The deployment profile allows 600 seconds for MCP and 700 seconds in the browser. Local examples use 300 and 315 seconds respectively. Configure ingress timeouts to match the deployed values and disable SSE buffering. Set `CORS_ALLOWED_ORIGINS` to the exact HTTPS UI origin without a trailing slash.

Raw debug output is disabled in the deployment profile. Enable it only for a restricted internal audience.

## Docker

Configure `backend/.env`, then run:

```powershell
docker compose up --build -d
docker compose ps
```

The manual-version image tags are `conversational-bi-backend-manual:local` and `conversational-bi-frontend-manual:local`. Host ports 3000 and 5173 must be free. Model-list changes require rebuilding the backend image; guide content changes require rebuilding the frontend image.

The frontend container reads public settings from its runtime environment and generates `runtime-config.js`. Its `frontend/.env` file is for Vite, not container runtime configuration.

Compose includes defaults for the frontend API URL, timeout and streaming flag. To override them, edit the frontend `environment` section in `docker-compose.yml` or set shell environment variables before running Compose.

To stop this copy:

```powershell
docker compose down
```

Do not include `node_modules`, generated output, private environment files or scratch files in a source handover. Dependencies are restored with `npm ci`. Each backend build clears only its own `backend/dist` directory before compiling, so removed modules cannot survive as stale JavaScript or source maps.

## Kubernetes deployment

Manifests are managed outside this repository.

- Frontend: unprivileged Nginx on port 8080, with `VITE_API_BASE_URL=/api/v1`.
- Backend: non-root Node process on port 3000, with `NODE_ENV=production`.
- Ingress: route `/api` to the BFF without stripping the prefix; route other paths to the frontend. Frontend Nginx does not proxy API requests.
- Access: restrict both UI and API. This shared-workspace build does not enforce separate user entitlements.
- Replicas: one BFF instance; sessions, cancellation, rate limits and usage counters are process-local.
- Probes: `/api/v1/health/live` and `/api/v1/health/ready`.
- Rollout: allow for the 10-second shutdown window and prefer an idle period. Backend restarts clear in-memory state.

Build release images with separate manual-version tags:

```powershell
docker build -f frontend/Dockerfile.frontend -t conversational-bi-frontend-manual:v1.0.0 .
docker build -f backend/Dockerfile.backend -t conversational-bi-backend-manual:v1.0.0 .
```

Use the agreed release tag instead of `v1.0.0` and add the registry path before pushing.

Before rollout, verify access restrictions, MCP connectivity, model IDs, timeouts and dependency findings. Readiness checks validate required configuration only; they do not test MCP connectivity or permissions.

After rollout, test both chat modes, each model, a follow-up, regeneration, table export, title lookup, reopening history and cross-tab synchronization. Check mobile layout and confirm logs contain no credentials or answer payloads.

## Checks

```powershell
npm.cmd run check
npm.cmd audit --omit=dev
```

`check` runs ESLint, TypeScript, Prettier and both production builds. It does not exercise live MCP or Kubernetes. This distribution has no checked-in automated test suite.

## Repository

- `frontend/`: UI, hardcoded model content, rendering and browser persistence.
- `backend/`: API, MCP integration, hardcoded model list and build scripts.
- `docs/`: Supporting documents and their source assets; excluded from images.
- `docker-compose.yml`: Local two-container deployment.
