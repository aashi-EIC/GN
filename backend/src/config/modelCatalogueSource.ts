import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { GetObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { AssumeRoleCommand, GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { config } from "./env.js";
import { ConfigurationError } from "../errors.js";
import { parseModelPolicy } from "./modelPolicy.js";

const MAX_GUIDE_BYTES = 1_048_576;
const roleArnPattern = /^arn:([a-z0-9-]+):iam::(\d{12}):role\/(?:[^\s]+\/)?([\w+=,.@-]{1,64})$/;

function isTargetRoleSession(arn: string, account: string, target: RegExpExecArray) {
  const session = /^arn:([a-z0-9-]+):sts::(\d{12}):assumed-role\/([^/]+)\/[^/]+$/.exec(arn);
  // IAM role names are unique within an account; STS session ARNs omit the IAM path.
  return (
    !!session &&
    session[1] === target[1] &&
    session[2] === target[2] &&
    account === target[2] &&
    session[3] === target[3]
  );
}

function parseJson(bytes: Buffer): unknown {
  if (bytes.length > MAX_GUIDE_BYTES) throw new Error("Catalogue document exceeds size limit");
  return JSON.parse(bytes.toString("utf8"));
}

async function readFileSource() {
  if (config.SEMANTIC_MODEL_POLICY_PATH && !config.SEMANTIC_MODEL_GUIDE_PATH) {
    throw new ConfigurationError("A custom local policy requires SEMANTIC_MODEL_GUIDE_PATH");
  }
  const policySource = config.SEMANTIC_MODEL_POLICY_PATH
    ? resolve(config.SEMANTIC_MODEL_POLICY_PATH)
    : new URL("../../config/semantic-model-user-policy.json", import.meta.url);
  const policy = parseModelPolicy(parseJson(await readFile(policySource)));
  // File mode uses an explicit offline guide, never follows the S3 pointer over the network.
  const guideSource = config.SEMANTIC_MODEL_GUIDE_PATH
    ? resolve(config.SEMANTIC_MODEL_GUIDE_PATH)
    : new URL("../../config/semantic-model-guide.json", import.meta.url);
  return { policy, guide: parseJson(await readFile(guideSource)) };
}

async function readS3Source() {
  const bucket = config.SEMANTIC_MODEL_GUIDE_S3_BUCKET;
  const key = config.SEMANTIC_MODEL_POLICY_S3_KEY;
  const roleArn = config.SEMANTIC_MODEL_GUIDE_ROLE_ARN;
  if (!bucket || !key) {
    throw new ConfigurationError("S3 catalogue requires a bucket and policy object key");
  }
  const authMode = config.SEMANTIC_MODEL_GUIDE_AUTH_MODE;
  if (authMode !== "pod" && !roleArn) {
    throw new ConfigurationError("S3 auto and assume-role authentication require a role ARN");
  }
  const targetRole = authMode === "auto" ? roleArnPattern.exec(roleArn!) : undefined;
  if (authMode === "auto" && !targetRole) {
    throw new ConfigurationError("S3 auto authentication requires a valid IAM role ARN");
  }

  let body: Readable | undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
    body?.destroy(new Error("Model catalogue read timed out"));
  }, config.SEMANTIC_MODEL_GUIDE_TIMEOUT_MS);
  timer.unref();
  const requestOptions = { abortSignal: controller.signal };
  const requestHandler = {
    connectionTimeout: 5_000,
    requestTimeout: config.SEMANTIC_MODEL_GUIDE_TIMEOUT_MS,
  };
  let sts: STSClient | undefined;
  let s3: S3Client | undefined;
  try {
    const clientOptions: S3ClientConfig = {
      region: config.SEMANTIC_MODEL_GUIDE_S3_REGION,
      maxAttempts: 2,
      requestHandler,
    };
    if (authMode !== "pod") {
      sts = new STSClient({
        region: config.SEMANTIC_MODEL_GUIDE_STS_REGION,
        maxAttempts: 2,
        requestHandler,
      });
      let assumeTargetRole = true;
      if (authMode === "auto") {
        const identity = await sts.send(new GetCallerIdentityCommand({}), requestOptions);
        const identityArn = /^arn:[a-z0-9-]+:(?:iam|sts)::(\d{12}):.+$/.exec(identity.Arn ?? "");
        if (!identityArn || identity.Account !== identityArn[1]) {
          throw new Error("AWS returned incomplete caller identity");
        }
        assumeTargetRole = !isTargetRoleSession(identity.Arn!, identity.Account!, targetRole!);
        // Reuse the identity provider we just checked instead of resolving a second chain.
        clientOptions.credentials = sts.config.credentials;
      }
      if (assumeTargetRole) {
        const { Credentials: credentials } = await sts.send(
          new AssumeRoleCommand({ RoleArn: roleArn, RoleSessionName: "S3AccessSession" }),
          requestOptions,
        );
        if (
          !credentials?.AccessKeyId ||
          !credentials.SecretAccessKey ||
          !credentials.SessionToken
        ) {
          throw new Error("AssumeRole returned incomplete credentials");
        }
        clientOptions.credentials = {
          accessKeyId: credentials.AccessKeyId,
          secretAccessKey: credentials.SecretAccessKey,
          sessionToken: credentials.SessionToken,
        };
      }
    }
    // Pod mode leaves credentials to the SDK provider chain; failures never change modes.
    const client = new S3Client(clientOptions);
    s3 = client;
    async function readObject(objectKey: string): Promise<unknown> {
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
        requestOptions,
      );
      body = response.Body instanceof Readable ? response.Body : undefined;
      if (!body) throw new Error("S3 returned no readable body");
      try {
        if (response.ContentLength !== undefined && response.ContentLength > MAX_GUIDE_BYTES) {
          throw new Error("Catalogue document exceeds size limit");
        }
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of body) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += bytes.length;
          if (size > MAX_GUIDE_BYTES) throw new Error("Catalogue document exceeds size limit");
          chunks.push(bytes);
        }
        return parseJson(Buffer.concat(chunks, size));
      } finally {
        body.destroy();
        body = undefined;
      }
    }
    const policy = parseModelPolicy(await readObject(key));
    if (policy.guideLocation.bucket !== bucket) {
      throw new ConfigurationError("Model guide must use the configured catalogue S3 bucket");
    }
    return { policy, guide: await readObject(policy.guideLocation.key) };
  } finally {
    clearTimeout(timer);
    body?.destroy();
    s3?.destroy();
    sts?.destroy();
  }
}

/** Read once at startup; never replace a failed S3 catalogue with local data. */
export async function readModelCatalogueSource() {
  try {
    return await (config.SEMANTIC_MODEL_GUIDE_SOURCE === "s3" ? readS3Source() : readFileSource());
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    // AWS errors can include request details. Expose only a safe diagnostic category.
    const category = error instanceof Error ? error.name : "UnknownError";
    const safeCategory = /^[a-zA-Z][a-zA-Z0-9]{0,79}$/.test(category) ? category : "UnknownError";
    throw new ConfigurationError(
      `Unable to load semantic model catalogue from ${config.SEMANTIC_MODEL_GUIDE_SOURCE} (${safeCategory})`,
    );
  }
}
