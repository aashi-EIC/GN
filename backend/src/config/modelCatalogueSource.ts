import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { config } from "./env.js";
import { ConfigurationError } from "../errors.js";
import { parseModelPolicy } from "./modelPolicy.js";

const MAX_GUIDE_BYTES = 1_048_576;

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
  if (!bucket || !key || !roleArn) {
    throw new ConfigurationError("S3 catalogue requires a bucket, policy object key and role ARN");
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
  // The SDK resolves the pod's source credentials; only temporary role credentials reach S3.
  const sts = new STSClient({
    region: config.SEMANTIC_MODEL_GUIDE_STS_REGION,
    maxAttempts: 2,
    requestHandler,
  });
  let s3: S3Client | undefined;
  try {
    const { Credentials: credentials } = await sts.send(
      new AssumeRoleCommand({ RoleArn: roleArn, RoleSessionName: "S3AccessSession" }),
      requestOptions,
    );
    if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
      throw new Error("AssumeRole returned incomplete credentials");
    }
    const client = new S3Client({
      region: config.SEMANTIC_MODEL_GUIDE_S3_REGION,
      credentials: {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
      },
      maxAttempts: 2,
      requestHandler,
    });
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
    sts.destroy();
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
