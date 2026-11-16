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

This verifies packaging, not S3 permissions. In S3 mode the backend follows MCP Server's fetch sequence: obtain source credentials through the SDK workload identity chain, call STS `AssumeRole` with `RoleSessionName=S3AccessSession`, create the S3 client with the returned access key, secret key and session token, then read the policy and its referenced guide before accepting requests. The deployment example uses STS in `us-east-1` and S3 in `us-west-2`.

S3 mode always assumes `SEMANTIC_MODEL_GUIDE_ROLE_ARN` using the pod's workload identity.

### Catalogue startup diagnostics

Failed AWS operations produce a structured `model_catalogue_load_failed` log before the existing configuration error. The `stage` identifies `assume_role`, `policy_read`, or `guide_read`; `auth_mode` is `assume-role`. `aws_error_code`, `aws_request_id`, and `http_status` retain their existing meanings and allowlisted formatting. Credential discovery and incomplete STS responses are diagnosed at `assume_role`; an SDK credential-provider failure may have no AWS request ID. Logs do not contain credential values, raw AWS messages, request/response bodies, or catalogue contents.

A role-assumption or S3 failure stops startup without changing identities or falling back to local files. Both documents keep their size limit and shared startup timeout, and the AWS clients and response streams are closed after loading.

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
