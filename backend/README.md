# Conversational BI backend

This folder builds independently of the frontend and repository root. It requires Node.js 22 and npm for native development, or Docker for container builds.

## Build an image

Run from this folder:

```sh
docker build -f Dockerfile.backend -t conv-bi-backend:local .
```

The build uses this folder's `package.json` and `package-lock.json`. The runtime installs production dependencies, including `@aws-sdk/client-s3` and `@aws-sdk/client-sts`. It runs as the non-root Node user on port 3000, with compiled code in `/app/dist` and catalogue files in `/app/config`.

Use the image's default `node dist/index.js` command. If Kubernetes overrides the command or mounts catalogue files, replace any old `/app/backend/dist` or `/app/backend/config` references with `/app/dist` or `/app/config`.

Environment files, host `node_modules`, tests, and precompiled output are excluded from the build context. Provide configuration at runtime using Kubernetes Secrets/ConfigMaps or `docker run --env-file .env`. AWS role access comes from the pod's workload identity; do not bake AWS credentials into the image.

Verify the SDKs without starting the server or contacting AWS:

```sh
docker run --rm --entrypoint node conv-bi-backend:local --input-type=module -e 'await import("@aws-sdk/client-sts"); await import("@aws-sdk/client-s3"); console.log("AWS SDK packages found");'
```

This verifies packaging, not S3 permissions. In S3 mode, startup reads the policy and its referenced guide before accepting requests. Set `SEMANTIC_MODEL_GUIDE_AUTH_MODE=pod` when the pod's existing AWS identity can read both objects. This uses the SDK credential provider chain without an additional explicit `AssumeRole` call. `SEMANTIC_MODEL_GUIDE_ROLE_ARN` is ignored in this mode; workload identity and token mounts remain deployment responsibilities.

Use `SEMANTIC_MODEL_GUIDE_AUTH_MODE=assume-role` when the workload must assume the configured target role first. This requires `SEMANTIC_MODEL_GUIDE_ROLE_ARN` and permission/trust for that extra STS call. The default remains `assume-role` for compatibility. Invalid mode values fail configuration validation. No mode falls back to another identity or to local files after an AWS failure. All require appropriate S3 permissions and network access.

The deployment example selects `SEMANTIC_MODEL_GUIDE_AUTH_MODE=auto`. This also requires a valid target role ARN. It first calls STS `GetCallerIdentity`: an assumed-role session matching the target partition, account and role name is reused directly; any other identity must explicitly assume the configured target. Identity lookup, role-assumption and S3 errors stop startup without trying another identity. An arbitrary assumed role is not sufficient to skip the configured target. Pod mode remains available when the pod has direct S3 access but does not need that target role. No setting repairs invalid source credentials or missing read permissions.

For file mode, use the bundled defaults or set paths under `/app/config`; Windows host paths do not exist in the container. Liveness is `/api/v1/health/live`; readiness is `/api/v1/health/ready`.

## Native development

When using this folder outside the workspace:

```sh
npm ci
npm run build
npm test
npm run dev
```

Create `.env` from `.env.example` and configure MCP before starting. Kubernetes deployments should use `.env.deployment.example` as the configuration reference.

The repository also retains its root workspace lockfile for development and frontend builds. After changing backend dependencies, regenerate this lockfile with `npm install --package-lock-only --workspaces=false` from this folder and update the root lockfile from the repository root. Verify both installations before delivery.
