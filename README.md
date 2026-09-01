# Conversational BI

Conversational BI is a React application with a Node.js Backend for Frontend (BFF). The browser authenticates users with Microsoft Entra ID and sends analytical prompts only to the BFF. The BFF validates access, enforces model permissions, manages sessions, and calls the external MCP host.

## Repository structure

```text
.
|-- frontend/                 React, Vite, MSAL and the chat interface
|   |-- public/               Brand assets
|   `-- src/
|       |-- app/              Application shell, routing and providers
|       |-- features/         Authentication, chat, debug and settings
|       `-- shared/           Reusable components, types and utilities
|-- backend/                  Express BFF and MCP integration
|   `-- src/
|       |-- application/      Chat orchestration
|       |-- http/             Routes and middleware
|       |-- integrations/     MCP request, response and authentication adapters
|       |-- persistence/      Replaceable process-local repositories
|       `-- security/         Content validation
|-- package.json              Workspace scripts and quality checks
`-- README.md
```

Generated output, dependencies, local environment files, installers, archives and credentials are intentionally excluded from source control.

## Requirements

- Node.js 22 LTS or newer
- npm 10 or newer
- A Microsoft Entra app registration with the frontend redirect URI configured as a Single-page application
- Client-provided BFF audience/scope and MCP connection settings

## Setup

Install the complete workspace from the repository root:

```powershell
npm.cmd ci
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

Replace every required blank or placeholder value in the two local `.env` files. The frontend must request the delegated BFF scope, not Microsoft Graph `User.Read`:

```dotenv
VITE_ENTRA_API_SCOPE=api://<backend-application-id>/access_as_user
```

All `VITE_*` values are compiled into browser JavaScript. Never place a client secret, MCP API key, password, private key or access token in `frontend/.env`. Server-only values belong in `backend/.env` or the deployment secret manager.

## Development

Run the BFF and frontend in separate terminals from the repository root:

```powershell
npm.cmd run dev --workspace backend
npm.cmd run dev --workspace frontend
```

The default URLs are <http://localhost:3000> for the BFF and <http://localhost:5173> for the frontend.

## Quality checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd run build
```

Run all checks together with `npm.cmd run check`.

## Frontend container

After creating `frontend/.env`, build from the repository root:

```powershell
docker compose --env-file frontend/.env -f frontend/docker-compose.frontend.yml up --build -d
```

The container serves the compiled single-page application at <http://localhost:5173>.

## Security and persistence

- Every protected BFF route validates the Entra token and derives ownership from validated claims.
- The browser never receives the MCP API key, OBO client secret or downstream token.
- MCP output is size-limited, validated and rendered as data/text; scripts are never executed.
- Sessions, settings, feedback and issue reports currently use process-local repositories and reset when the BFF restarts. Replace these repositories with client-owned persistent storage before horizontal production scaling.

See [backend/README.md](backend/README.md) for the API contract, authentication modes and deployment configuration.
