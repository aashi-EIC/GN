# Conversational BI

Conversational BI is a React application for exploring semantic-model data through an MCP-backed
analytics service. The browser talks to a small Node.js backend-for-frontend (BFF), which validates
requests, manages chat sessions, and translates messages between the UI and the MCP endpoint.

This branch intentionally has no Microsoft Entra integration. Everyone who can reach the
application shares the same workspace identity, so it must sit behind an approved company access
layer such as an SSO gateway, VPN, or private network.

## Project layout

```text
backend/                    Express BFF and MCP integration
frontend/                   React and Vite application
docker-compose.yml          Local two-container deployment
package.json                Workspace scripts shared by both applications
```

The frontend and backend are built as separate images. In Kubernetes, one Ingress sends `/api`
requests to the BFF and all other requests to the frontend. The UI therefore uses `/api/v1` as a
same-origin API address and does not depend on an internal Kubernetes service name in the browser.

## Prerequisites

- Node.js 22 LTS or newer
- npm 10 or newer
- Docker with Docker Compose for local container testing
- Access to the MCP endpoint

## Run locally

Install the workspace dependencies and create local configuration files:

```powershell
npm.cmd ci
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

Set `MCP_BASE_URL` in `backend/.env`, then start each application in a separate terminal:

```powershell
npm.cmd run dev --workspace backend
```

```powershell
npm.cmd run dev --workspace frontend
```

Open <http://localhost:5173>. The BFF listens on <http://localhost:3000>.

## Configuration

The example files document every supported setting:

- `frontend/.env.example` contains the public BFF URL and request timeout.
- `backend/.env.example` contains server, CORS, model catalogue, rate-limit, Redis, and MCP options.

Use `MCP_AUTH_MODE=none` when the MCP endpoint accepts unauthenticated server-to-server requests.
For an API key, use `MCP_AUTH_MODE=api-key` and set `MCP_API_KEY_HEADER` and
`MCP_API_KEY_VALUE`. Never put the API key in a frontend variable or commit a populated `.env`
file.

Redis is optional. Without `REDIS_URL`, rate limiting and chat state are process-local. Keep the
backend at one replica until shared persistence is introduced.

## Run with Docker Compose

Create and configure `backend/.env` first, then run:

```powershell
docker compose up --build -d
docker compose ps
```

The frontend is available on port 5173 and the backend on port 3000. Stop the stack with:

```powershell
docker compose down
```

## Build the deployment images

Run both commands from the repository root:

```powershell
docker build -f frontend/Dockerfile.frontend -t docker-registry.prod.gracenote.com/gn-bia/conv-bi-frontend-no-entra:v1.0.0 .
docker build -f backend/Dockerfile.backend -t docker-registry.prod.gracenote.com/gn-bia/conv-bi-backend-no-entra:v1.0.0 .
```

The frontend uses unprivileged Nginx on container port 8080. The backend runs as the non-root Node
user on port 3000. Both images include health checks.

Push the images only after updating the tag to the release version agreed with the platform team.

## Quality checks

Run the complete verification suite before opening a merge request:

```powershell
npm.cmd run check
```

This runs ESLint, TypeScript checks, Prettier verification, and production builds for both
applications.
