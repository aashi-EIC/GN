# Conversational BI frontend

This package builds the Conversational BI React application and serves it from an Nginx container.

## Package contents

The delivery consists of:

1. A ZIP file containing the source code and Docker configuration.
2. A separate `.env` file containing the environment-specific frontend configuration.

Keep the `.env` file outside the ZIP during transfer. After extracting the ZIP, place `.env` in the extracted root folder, beside `Dockerfile.frontend` and `docker-compose.frontend.yml`.

The extracted folder should contain:

```text
conversational-bi/
├── frontend/
├── .env
├── .dockerignore
├── Dockerfile.frontend
├── docker-compose.frontend.yml
└── nginx.frontend.conf
```

## Prerequisites

- Docker Desktop on Windows or macOS, or Docker Engine with the Compose plugin on Linux
- Docker configured to use Linux containers
- Port `5173` available on the host
- The frontend URL registered as a Single-page application redirect URI in Microsoft Entra ID

No local Node.js or npm installation is required when using Docker.

## Environment configuration

The separately supplied `.env` file must contain:

```dotenv
VITE_ENTRA_CLIENT_ID=<application-client-id>
VITE_ENTRA_TENANT_ID=<directory-tenant-id>
VITE_ENTRA_API_SCOPE=User.Read
VITE_API_BASE_URL=<browser-accessible-node-bff-url>/api/v1
```

`User.Read` is the current scope for frontend login and SSO testing. After the Node BFF exposes a delegated scope, replace it with the client-approved value, such as:

```dotenv
VITE_ENTRA_API_SCOPE=api://<backend-application-id>/access_as_user
```

All `VITE_*` values are compiled into browser JavaScript. Do not place client secrets, API keys, passwords, private keys, certificates, or access tokens in these variables.

## Build and run

Open PowerShell or a terminal in the extracted root folder and run:

```powershell
docker compose -f docker-compose.frontend.yml up --build -d
```

Docker will install frontend dependencies, build the React application, create the Nginx image, and start the container.

Open the application at:

```text
http://localhost:5173
```

## Verify the deployment

Check container status:

```powershell
docker compose -f docker-compose.frontend.yml ps
```

The frontend service should show as `Up` and then `healthy`.

View logs:

```powershell
docker compose -f docker-compose.frontend.yml logs --tail 100 frontend
```

Verify the HTTP response from PowerShell:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:5173).StatusCode
```

The expected status is `200`.

## Stop or restart

Stop and remove the container:

```powershell
docker compose -f docker-compose.frontend.yml down
```

Restart it:

```powershell
docker compose -f docker-compose.frontend.yml up -d
```

## Apply environment changes

Vite reads environment values while the image is built. If `.env` changes, rebuild the image:

```powershell
docker compose -f docker-compose.frontend.yml down
docker compose -f docker-compose.frontend.yml build --no-cache frontend
docker compose -f docker-compose.frontend.yml up -d
```

## Microsoft Entra redirect URI

For local Docker testing, configure this exact URI under the app registration's **Authentication > Single-page application** platform:

```text
http://localhost:5173
```

For a deployed environment, register the exact HTTPS frontend address instead. The scheme, host, port, path, and trailing slash must match the address used by the browser.

## Troubleshooting

### Port 5173 is already in use

Stop the process or container using the port, or change the Compose mapping from:

```yaml
ports:
  - "5173:80"
```

to another available host port, for example `5174:80`. Add the resulting URL to the Entra SPA redirect URIs.

### Entra sign-in returns to the login page

Confirm that the client ID, tenant ID, scope, and redirect URI match the Entra app registration. Rebuild the image after changing `.env`.

### Frontend loads but API requests fail

`VITE_API_BASE_URL` is used by the user's browser, so it must be reachable from that browser. The Node BFF must also allow the frontend origin through CORS. `localhost` refers to the user's own computer, not another Docker host or remote server.

### Review container logs

```powershell
docker compose -f docker-compose.frontend.yml logs -f frontend
```
