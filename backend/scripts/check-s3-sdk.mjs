import { Readable } from "node:stream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

const bucket = process.env.SEMANTIC_MODEL_GUIDE_S3_BUCKET || "q-lib";
const policyKey =
  process.env.SEMANTIC_MODEL_POLICY_S3_KEY ||
  "CONVERSATIONAL_BI_FRONTEND_JSON_CONFIG/semantic_model_user_policy/semantic_model_user_policy.json";
const roleArn =
  process.env.SEMANTIC_MODEL_GUIDE_ROLE_ARN ||
  "arn:aws:iam::700997598514:role/dev-team-irsa-role-nonprod";
const s3Region = process.env.SEMANTIC_MODEL_GUIDE_S3_REGION || "us-west-2";
const stsRegion = process.env.SEMANTIC_MODEL_GUIDE_STS_REGION || "us-east-1";
const direct = process.argv.includes("--direct");
const maxBytes = 1_048_576;
const controller = new AbortController();
const requestHandler = { connectionTimeout: 5_000, requestTimeout: 30_000 };
let stage = direct ? "policy_read" : "assume_role";
let sts;
let s3;
let body;

function report(fields) {
  process.stdout.write(JSON.stringify({ event_type: "standalone_s3_sdk_check", ...fields }) + "\n");
}

function fail(code) {
  const error = new Error(code);
  error.name = code;
  throw error;
}

async function readJson(objectBucket, key, readStage) {
  stage = readStage;
  report({ stage, result: "started", bucket: objectBucket, key });
  const response = await s3.send(new GetObjectCommand({ Bucket: objectBucket, Key: key }), {
    abortSignal: controller.signal,
  });
  body = response.Body instanceof Readable ? response.Body : undefined;
  if (!body) fail("MissingObjectBody");
  try {
    if (response.ContentLength > maxBytes) fail("ObjectTooLarge");
    const chunks = [];
    let bytesRead = 0;
    for await (const chunk of body) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytesRead += bytes.length;
      if (bytesRead > maxBytes) fail("ObjectTooLarge");
      chunks.push(bytes);
    }
    const document = JSON.parse(Buffer.concat(chunks, bytesRead).toString("utf8"));
    report({ stage, result: "ok", bytes_read: bytesRead });
    return document;
  } finally {
    body.destroy();
    body = undefined;
  }
}

const timer = setTimeout(() => {
  controller.abort();
  body?.destroy(new Error("S3 check timed out"));
}, 30_000);
timer.unref();

try {
  report({ result: "started", mode: direct ? "pod_credentials" : "assume_role" });
  let credentials;
  if (!direct) {
    report({ stage, result: "started", role_arn: roleArn });
    sts = new STSClient({ region: stsRegion, maxAttempts: 2, requestHandler });
    const { Credentials: session } = await sts.send(
      new AssumeRoleCommand({ RoleArn: roleArn, RoleSessionName: "S3AccessSession" }),
      { abortSignal: controller.signal },
    );
    if (!session?.AccessKeyId || !session.SecretAccessKey || !session.SessionToken) {
      fail("IncompleteRoleCredentials");
    }
    credentials = {
      accessKeyId: session.AccessKeyId,
      secretAccessKey: session.SecretAccessKey,
      sessionToken: session.SessionToken,
    };
    report({ stage, result: "ok" });
  }

  s3 = new S3Client({ region: s3Region, maxAttempts: 2, requestHandler, credentials });
  const policy = await readJson(bucket, policyKey, "policy_read");
  stage = "guide_read";
  const guideLocation =
    typeof policy?.model_guide_s3_path === "string"
      ? /^s3:\/\/([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/([^?#\\]+)$/.exec(policy.model_guide_s3_path)
      : undefined;
  if (!guideLocation) fail("InvalidGuideS3Path");
  await readJson(guideLocation[1], guideLocation[2], "guide_read");
  report({ result: "success", message: "Both S3 JSON objects downloaded and parsed" });
} catch (error) {
  const code = error instanceof Error ? error.name : "UnknownError";
  const requestId = error?.$metadata?.requestId;
  const status = error?.$metadata?.httpStatusCode;
  report({
    stage,
    result: "failed",
    aws_error_code: /^[a-zA-Z][a-zA-Z0-9]{0,79}$/.test(code) ? code : "UnknownError",
    ...(typeof requestId === "string" && /^[a-zA-Z0-9+=/_:.-]{1,256}$/.test(requestId)
      ? { aws_request_id: requestId }
      : {}),
    ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { http_status: status } : {}),
  });
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  body?.destroy();
  s3?.destroy();
  sts?.destroy();
}
