# Frontend Docker handover

This package contains the Conversational BI frontend and everything required to build and run it as an Nginx container.

## Prerequisites

- Docker Desktop or Docker Engine with Docker Compose
- A Microsoft Entra single-page application registration
- A browser-accessible backend API

## Configure the frontend

Copy the environment template before building:

```powershell
Copy-Item .env.example .env
```

Replace the placeholders in `.env`:

```dotenv
VITE_ENTRA_CLIENT_ID=<frontend-spa-application-client-id>
VITE_ENTRA_TENANT_ID=<directory-tenant-id>
VITE_ENTRA_API_SCOPE=User.Read
VITE_API_BASE_URL=https://api.example.com/api/v1
```

These values are compiled into the browser application and must not contain secrets. Never add an Entra client secret, password, private key, or permanent access token to a `VITE_*` variable.

## Build and run

```powershell
docker compose -f docker-compose.frontend.yml up --build -d
```

The default local address is <http://localhost:5173>.

Check the container:

```powershell
docker compose -f docker-compose.frontend.yml ps
docker compose -f docker-compose.frontend.yml logs frontend
```

Stop the container:

```powershell
docker compose -f docker-compose.frontend.yml down
```

## Microsoft Entra configuration

Add the application's exact public URL under **Authentication > Single-page application > Redirect URIs**. For local testing, use `http://localhost:5173`. Production deployments should use an HTTPS URL.

`User.Read` is used for the current frontend login test. When the Node BFF scope is available, grant that delegated permission to the frontend registration and replace `User.Read` with its full scope value.

The backend must allow the frontend origin through CORS. `VITE_API_BASE_URL` must be reachable by the user's browser; a Docker-internal service name is not browser-accessible unless traffic is routed through a public reverse proxy.

## Rebuild after configuration changes

Vite environment values are build-time configuration. Rebuild the image whenever an environment value changes:

```powershell
docker compose -f docker-compose.frontend.yml build --no-cache frontend
docker compose -f docker-compose.frontend.yml up -d frontend
```
