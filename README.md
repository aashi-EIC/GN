# Conversational BI

This package contains the React frontend and Node.js Backend for Frontend (BFF). Real `.env` files, installed dependencies, build output and credentials are intentionally excluded.

## Package layout

```text
Conversational-BI/
|-- frontend/
|   |-- .env.example
|   |-- package.json
|   `-- package-lock.json
|-- backend/
|   |-- .env.example
|   |-- package.json
|   `-- package-lock.json
`-- README.md
```

## Requirements

- Node.js 20 or newer for the backend
- Node.js 22 or newer for the frontend
- npm, included with Node.js
- The frontend URL registered as a Single-page application redirect URI in Microsoft Entra ID

## Install dependencies after extraction

`node_modules` is intentionally excluded. From the extracted package root, install the exact dependency versions from the lockfiles:

```powershell
cd frontend
npm ci
cd ../backend
npm ci
cd ..
```

If PowerShell blocks `npm.ps1`, use:

```powershell
cd frontend
npm.cmd ci
cd ../backend
npm.cmd ci
cd ..
```

## Configure the environments

Create local environment files from the supplied templates:

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

Replace the placeholders with client-provided values. The frontend environment requires:

```dotenv
VITE_ENTRA_CLIENT_ID=<application-client-id>
VITE_ENTRA_TENANT_ID=<directory-tenant-id>
VITE_ENTRA_API_SCOPE=User.Read
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

After the BFF delegated scope is configured, replace `User.Read` with the client-approved BFF scope, such as `api://<backend-application-id>/access_as_user`.

All `VITE_*` values are compiled into browser JavaScript. Never place an Entra client secret, MCP API key, password, private key or access token in the frontend environment. Server-only values belong in `backend/.env` or the deployment secret manager.

## Run locally

Start the backend from one terminal:

```powershell
cd backend
npm run dev
```

Start the frontend from another terminal:

```powershell
cd frontend
npm run dev
```

## Run the frontend with Docker

Docker installs frontend dependencies during the image build, so running `npm ci` locally is not required for this workflow.

```powershell
cd frontend
docker compose -f docker-compose.frontend.yml up --build -d
```

The default frontend address is <http://localhost:5173>.

