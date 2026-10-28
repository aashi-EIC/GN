# Frontend

This folder builds independently of the backend and repository root. Use Node.js 22 and npm for native development, or Docker for container builds.

## Standalone image

Run from this folder:

```sh
docker build -f Dockerfile.frontend -t conv-bi-frontend:local .
```

The build uses this folder's `package.json` and `package-lock.json`. The runtime serves the production bundle through unprivileged Nginx on port 8080. Root workspace files and backend source are not required. Environment files, host dependencies, tests, and generated output are excluded from the build context.

For a registry build from this folder:

```sh
docker buildx build --platform linux/amd64 --provenance=false -f Dockerfile.frontend -t REGISTRY/conv-bi-frontend:TAG --push .
```

Replace `REGISTRY` and `TAG` with the release destination and version.

## Runtime configuration

Configure the frontend pod using `.env.deployment.example`. The entrypoint generates `runtime-config.js` from environment variables at container startup; rebuilding the image is not necessary when those values change.

- `VITE_API_BASE_URL=/api/v1` for same-origin ingress routing.
- `VITE_API_TIMEOUT_MS=700000` as specified by the deployment profile.
- `VITE_CHAT_STREAMING_ENABLED=true` to enable streaming capability checks.

The ingress must route `/api` to the backend without stripping the prefix, and other paths to this container. Nginx in this image does not proxy the API. The backend must enable streaming separately. Frontend runtime configuration is public: never place AWS credentials or other secrets here.

## Standalone verification

```sh
npm ci --workspaces=false --include=dev
npm run build
```

To check the image without starting an application backend:

```sh
docker run --rm -d --name conv-bi-frontend-check -p 127.0.0.1:18080:8080 -e VITE_API_BASE_URL=/api/v1 -e VITE_CHAT_STREAMING_ENABLED=true conv-bi-frontend:local
curl -f http://127.0.0.1:18080/chat/stream
curl -f http://127.0.0.1:18080/runtime-config.js
docker stop conv-bi-frontend-check
```

This checks static routing and runtime configuration, not backend connectivity or live streaming. Verify those through the deployed ingress with a working backend.

When dependencies change, update this folder's lockfile with `npm install --package-lock-only --workspaces=false`, and update the repository root lockfile separately for workspace development.
