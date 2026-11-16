# S3 catalogue startup failure

The backend now follows MCP Server's single S3 flow: resolve workload credentials, explicitly assume the configured target role, then use the returned temporary session to read the policy and guide.

The reported `Unable to load semantic model catalogue from s3 (AccessDenied)` occurs before the backend starts listening. The frontend cannot receive its model catalogue until this succeeds. The stack trace alone does not identify the denied AWS operation. The user reports that IAM-based access and S3 grants are configured; no manual AWS keys or custom credential-file loader are added.

## Findings from the supplied code

| Item                                 | MCP Host / Server archives                                                     | This backend                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Bucket in the supplied configuration | `q-lib`                                                                        | `q-lib`                                                          |
| Objects                              | `CONVERSATIONAL_BI_SEMANTIC_MODEL_SCHEMAS/*.txt`                               | Policy and guide under `CONVERSATIONAL_BI_FRONTEND_JSON_CONFIG/` |
| Target role                          | `arn:aws:iam::700997598514:role/dev-team-irsa-role-nonprod`                    | Same target in the deployment example                            |
| AWS libraries                        | boto3 / aioboto3                                                               | AWS SDK for JavaScript v3                                        |
| Source identity                      | Determined by each MCP pod's runtime environment and credential provider chain | Determined independently by the backend pod                      |

The MCP manifests inject `mcp-host-secrets` and `mcp-server-secrets`. They do not specify `serviceAccountName`. This does not establish their actual deployed AWS identity: the running workloads, namespace defaults, Pod Identity associations, admission changes, and Secret contents are not available in the archives. No Secret values need to be shared to compare the identities.

The backend SDK packages are installed and include workload credential providers. The inspected local installation has S3/STS clients at `3.1154.0`. JavaScript v3 supports EKS Pod Identity from `3.458.0`; changing SDK language is not the indicated remedy.

The supplied stack trace matches the catch at line 157 in `backend.zip`'s compiled loader, which hides the underlying AWS error and operation. The current working source already has stage-specific diagnostics; those existing edits were preserved. An image rebuild and rollout would be required to use them. The diagnostic below also works with the older installed loader.

## Identify the denied operation without rebuilding

Run from the repository root in PowerShell, substituting the real namespace and backend pod name:

```powershell
Get-Content -Raw .\backend\scripts\check-s3-sdk.mjs | kubectl -n <namespace> exec -i <backend-pod> -- node --input-type=module
```

For a multi-container pod, add `-c <backend-container>` to `kubectl exec`. The backend image uses `/app` as its working directory. If the workload overrides it, run Node with a shell that first changes to `/app`.

The script executes in a separate process, reuses the installed catalogue loader and its authentication behavior, and reads the same S3 objects. It does not start the server, modify AWS resources, change pod settings, print AWS credential values, or print object contents. It prints whether common credential inputs are present, not their values. It can make the loader's configured STS calls, including `AssumeRole` to obtain temporary credentials. `request_succeeded` means the AWS request succeeded; `catalogue_source_loaded` means the loader also consumed and parsed both documents. This does not validate the final model-guide schema or the UI.

If the pod is restarting too quickly for `exec`, use the current source's diagnostics in a rebuilt image and obtain the previous container's logs:

```powershell
kubectl -n <namespace> logs <backend-pod> --previous --tail=100
```

The diagnostic stages have the following meanings:

| Failed stage                               | What to inspect                                                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity_check` / `credential_resolution` | Initial workload credentials, IRSA/Pod Identity binding, and role trust. An SDK operation can fail while resolving initial credentials, before that operation reaches its service. |
| `assume_role`                              | Source identity's ability to assume the configured target, target role trust, and applicable denies. Credential resolution can also fail here.                                     |
| `policy_read`                              | Credential resolution if no credentials have yet been obtained; otherwise access to the exact policy key, its existence, bucket/endpoint policy, and encryption key permissions.   |
| `guide_read`                               | Access to the guide object selected by the policy, its existence, bucket/endpoint policy, and encryption key permissions.                                                          |

## Apply the fix indicated by the stage

### Role selection

The backend calls STS `AssumeRole` with `SEMANTIC_MODEL_GUIDE_ROLE_ARN` and `RoleSessionName=S3AccessSession`, matching MCP Server. The deployment profile uses STS in `us-east-1` and S3 in `us-west-2`. The returned access key, secret key and session token are all supplied to the S3 client. The target session reads both objects once at startup.

No explicit `GetCallerIdentity` lookup, same-role comparison, or direct S3 branch runs. The SDK may still call `AssumeRoleWithWebIdentity` internally to obtain the source workload credentials before the explicit target-role assumption. The diagnostic stage for source resolution and target assumption is `assume_role`.

S3 mode always assumes the target role. There is no authentication-mode environment setting.

### Object access

The user reports that access has been granted. The following object paths are retained for correlation if a diagnostic log identifies an S3 denial; no AWS policy changes were made.

MCP schema access does not establish catalogue access, even in the same bucket. The role used for the S3 reads needs `s3:GetObject` on the policy object and the object named by that policy's `model_guide_s3_path`.

For the supplied policy and deployment example, the narrowly scoped object resources are:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::q-lib/CONVERSATIONAL_BI_FRONTEND_JSON_CONFIG/semantic_model_user_policy/semantic_model_user_policy.json",
        "arn:aws:s3:::q-lib/CONVERSATIONAL_BI_FRONTEND_JSON_CONFIG/semantic_model_guide/semantic_model_guide.json"
      ]
    }
  ]
}
```

Confirm the actual deployed bucket/key and the actual policy's guide pointer before using these resources. This policy is a proposed permission statement, not an applied change or a guarantee against explicit denies. If the objects use SSE-KMS, inspect the KMS key policy and `kms:Decrypt` authorization as well. Cross-account access can require a bucket-policy grant. Bucket, VPC endpoint, organization, and other applicable explicit denies must also be addressed.

Confirm both case-sensitive object keys exist. A nonexistent object can return `403 AccessDenied` when the caller lacks `s3:ListBucket`; this loader does not otherwise need listing permission. Do not add broad listing access just to diagnose that case.

## Validation and limits

The catalogue unit and SDK integration test files have been removed. The results below describe checks run before their removal; `backend/test/backend.test.mjs` remains.

The catalogue unit tests verify the single target-role assumption, both object reads, required configuration, stream/client cleanup, failure behavior, safe error categories, and real structured startup logs. Incomplete STS credentials are also diagnosed at `assume_role`.

The SDK integration tests replace only the HTTP transport. The installed SDK resolves credentials, serializes requests, signs them, parses XML responses/errors, and streams JSON bodies. They verify the MCP session name, STS/S3 regions, both exact object keys, all three temporary credential fields, and IRSA source resolution followed by the target-role assumption. No caller-identity lookup or direct-read branch is accepted. Actual XML STS and S3 denials retain the expected diagnostic stage, `aws_error_code`, `aws_request_id`, and `http_status`.

The standalone diagnostic script remains usable with both older deployed loaders and the new loader. Its `identity_check` label applies only to older images that used the removed automatic identity branch. The current loader emits `assume_role`, `policy_read`, and `guide_read` stages. Credentials, raw AWS messages, and catalogue contents are excluded from its output.

All 31 backend tests, repository lint, TypeScript checks, formatting checks, and the backend build passed. A separate compiled-loader smoke check confirmed that the standalone script retains the diagnostic stage, AWS error code, request ID and HTTP status without printing synthetic credentials or raw error details. The normal frontend build encountered a sandbox parent-directory access error during config bundling; the production build passed with Vite's `--configLoader native`, without frontend configuration changes.

Timeouts, the per-document 1 MiB limit, JSON/schema validation, and explicit file mode remain in place. An AWS failure does not change identity or fall back to bundled data. The earlier Docker config-copy repair remains in place and does not alter S3 behavior.

No Kubernetes/IAM resources were changed or live AWS requests made. A backend image rebuild and rollout with the updated auth setting are needed to apply the change to Kubernetes. Live access remains unverified from this session.

References: [Node.js credential chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html), [EKS Pod Identity SDK support](https://docs.aws.amazon.com/eks/latest/userguide/pod-id-minimum-sdk.html), [role self-assumption](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_update-role-trust-policy.html), [S3 GetObject permissions and missing objects](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html), [S3 access-denied troubleshooting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/troubleshoot-403-errors.html).
