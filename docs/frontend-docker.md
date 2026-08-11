# Frontend Docker deployment

This container builds the Vite React frontend and serves the static files with Nginx.

## 1. Create frontend environment values

Create a root `.env` file from `.env.example`.

```env
VITE_ENTRA_CLIENT_ID=<client-app-id>
VITE_ENTRA_TENANT_ID=<tenant-id>
VITE_ENTRA_API_SCOPE=User.Read
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

For a deployed environment, change `VITE_API_BASE_URL` to the public URL of the Node BFF, for example:

```env
VITE_API_BASE_URL=https://api.example.com/api/v1
```

Vite reads these values at build time, so rebuild the image after changing them.

## 2. Build and run with Docker Compose

```powershell
docker compose -f docker-compose.frontend.yml build
docker compose -f docker-compose.frontend.yml up
```

Open:

```text
http://localhost:5173
```

## 3. Build and run with plain Docker

```powershell
docker build -f Dockerfile.frontend -t conversational-bi-frontend `
  --build-arg VITE_ENTRA_CLIENT_ID=<client-app-id> `
  --build-arg VITE_ENTRA_TENANT_ID=<tenant-id> `
  --build-arg VITE_ENTRA_API_SCOPE=User.Read `
  --build-arg VITE_API_BASE_URL=http://localhost:3000/api/v1 .

docker run --rm -p 5173:80 conversational-bi-frontend
```

## 4. Entra redirect URI

For local Docker testing, add this redirect URI in Entra ID:

```text
http://localhost:5173
```

For production, add the actual frontend URL, for example:

```text
https://conversational-bi.example.com
```
