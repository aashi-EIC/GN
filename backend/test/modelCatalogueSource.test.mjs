import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, mock, test } from "node:test";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AssumeRoleCommand, GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";

// Isolated worker: no private env files, credential discovery or AWS requests.
Object.assign(process.env, {
  DOTENV_CONFIG_PATH: join(tmpdir(), "convbi-catalogue-test-" + randomUUID()),
  NODE_ENV: "test",
  SEMANTIC_MODEL_GUIDE_SOURCE: "s3",
  SEMANTIC_MODEL_GUIDE_AUTH_MODE: "assume-role",
  SEMANTIC_MODEL_GUIDE_S3_BUCKET: "demo-bucket",
  SEMANTIC_MODEL_POLICY_S3_KEY: "policy.json",
  SEMANTIC_MODEL_GUIDE_ROLE_ARN: "arn:aws:iam::123456789012:role/demo-reader",
  SEMANTIC_MODEL_GUIDE_S3_REGION: "us-west-2",
  SEMANTIC_MODEL_GUIDE_STS_REGION: "us-east-1",
  SEMANTIC_MODEL_GUIDE_TIMEOUT_MS: "30000",
  AWS_ACCESS_KEY_ID: "synthetic-source-key",
  AWS_SECRET_ACCESS_KEY: "synthetic-source-secret",
  AWS_SESSION_TOKEN: "synthetic-source-session",
  AWS_EC2_METADATA_DISABLED: "true",
});
const { config } = await import("../src/config/env.ts");
const { readModelCatalogueSource } = await import("../src/config/modelCatalogueSource.ts");
const { parseModelGuide } = await import("../src/config/modelGuide.ts");
const { applyModelPolicy } = await import("../src/config/modelPolicy.ts");
const initial = { ...config };
const policy = {
  version: "1.0",
  model_guide_s3_path: "s3://demo-bucket/guide.json",
  semantic_models: { demo: { semantic_model_id: "demo", display_name: "Demo from policy" } },
};
const guide = {
  modelGuide: {
    tabs: ["Overview", "Prompts"],
    models: [
      { id: "demo", name: "Demo", short: "D", description: "Synthetic model", overview: {} },
    ],
  },
};
const assumedCredentials = {
  AccessKeyId: "synthetic-target-key",
  SecretAccessKey: "synthetic-target-secret",
  SessionToken: "synthetic-target-session",
};
let calls,
  destroyed,
  bodies,
  identity,
  sourceProvider,
  stsFailure,
  s3Failure,
  incompleteCredentials;
beforeEach(() => {
  Object.assign(config, initial);
  calls = [];
  destroyed = [];
  bodies = [];
  identity = {
    Account: "123456789012",
    Arn: "arn:aws:sts::123456789012:assumed-role/demo-reader/session",
  };
  sourceProvider = mock.fn(async () => ({
    accessKeyId: "checked-source-key",
    secretAccessKey: "checked-source-secret",
    sessionToken: "checked-source-session",
  }));
  stsFailure = undefined;
  s3Failure = undefined;
  incompleteCredentials = false;
  mock.method(STSClient.prototype, "send", async function (command, options) {
    calls.push({ service: "sts", command, options, client: this });
    if (stsFailure) throw stsFailure;
    if (command instanceof GetCallerIdentityCommand) {
      this.config.credentials = sourceProvider;
      return identity;
    }
    assert.ok(command instanceof AssumeRoleCommand);
    return {
      Credentials: incompleteCredentials ? { AccessKeyId: "incomplete" } : assumedCredentials,
    };
  });
  mock.method(S3Client.prototype, "send", async function (command, options) {
    calls.push({ service: "s3", command, options, client: this });
    assert.ok(command instanceof GetObjectCommand);
    if (s3Failure) throw s3Failure;
    const bytes = Buffer.from(JSON.stringify(command.input.Key === "policy.json" ? policy : guide));
    const body = Readable.from([bytes]);
    bodies.push(body);
    return { Body: body, ContentLength: bytes.length };
  });
  mock.method(STSClient.prototype, "destroy", function () {
    destroyed.push(this);
  });
  mock.method(S3Client.prototype, "destroy", function () {
    destroyed.push(this);
  });
});
afterEach(() => {
  mock.restoreAll();
  Object.assign(config, initial);
});
const s3Calls = () => calls.filter((call) => call.service === "s3");
const stsCalls = () => calls.filter((call) => call.service === "sts");
const denied = () =>
  Object.assign(new Error("private AWS detail must not escape"), { name: "AccessDenied" });
async function loadAndCheck() {
  const result = await readModelCatalogueSource();
  const catalogue = applyModelPolicy(parseModelGuide(result.guide), result.policy);
  assert.equal(catalogue.models[0].name, "Demo from policy");
  assert.deepEqual(
    s3Calls().map((call) => call.command.input),
    [
      { Bucket: "demo-bucket", Key: "policy.json" },
      { Bucket: "demo-bucket", Key: "guide.json" },
    ],
  );
  assert.equal(new Set(calls.map((call) => call.options.abortSignal)).size, 1);
  assert.ok(bodies.every((body) => body.destroyed));
}

test("pod mode reads both objects without an extra STS call or target ARN", async () => {
  config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = "pod";
  config.SEMANTIC_MODEL_GUIDE_ROLE_ARN = undefined;
  await loadAndCheck();
  assert.equal(stsCalls().length, 0);
  assert.equal(
    (await s3Calls()[0].client.config.credentials()).accessKeyId,
    "synthetic-source-key",
  );
  assert.equal(destroyed.length, 1);
});

test("explicit assume-role mode retains the existing behavior and target credentials", async () => {
  await loadAndCheck();
  assert.equal(stsCalls().length, 1);
  assert.ok(stsCalls()[0].command instanceof AssumeRoleCommand);
  assert.equal(stsCalls()[0].command.input.RoleArn, initial.SEMANTIC_MODEL_GUIDE_ROLE_ARN);
  const credentials = await s3Calls()[0].client.config.credentials();
  assert.equal(credentials.accessKeyId, assumedCredentials.AccessKeyId);
  assert.equal(credentials.sessionToken, assumedCredentials.SessionToken);
  assert.equal(destroyed.length, 2);
});

test("auto reuses the target-role session and the exact checked provider", async () => {
  config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = "auto";
  await loadAndCheck();
  assert.equal(stsCalls().length, 1);
  assert.ok(stsCalls()[0].command instanceof GetCallerIdentityCommand);
  const credentials = await s3Calls()[0].client.config.credentials();
  assert.equal(credentials.accessKeyId, "checked-source-key");
  assert.equal(sourceProvider.mock.callCount(), 1);
  assert.equal(destroyed.length, 2);
});

test("auto recognizes an IAM target role with a path", async () => {
  config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = "auto";
  config.SEMANTIC_MODEL_GUIDE_ROLE_ARN = "arn:aws:iam::123456789012:role/team/service/demo-reader";
  await loadAndCheck();
  assert.equal(stsCalls().length, 1);
});

for (const [name, caller] of [
  [
    "different role",
    { Account: "123456789012", Arn: "arn:aws:sts::123456789012:assumed-role/other/session" },
  ],
  [
    "same role name in another account",
    { Account: "999999999999", Arn: "arn:aws:sts::999999999999:assumed-role/demo-reader/session" },
  ],
  [
    "same role name in another partition",
    {
      Account: "123456789012",
      Arn: "arn:aws-us-gov:sts::123456789012:assumed-role/demo-reader/session",
    },
  ],
  ["IAM user", { Account: "123456789012", Arn: "arn:aws:iam::123456789012:user/demo" }],
]) {
  test(`auto assumes only the configured target for a ${name}`, async () => {
    config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = "auto";
    identity = caller;
    await loadAndCheck();
    assert.deepEqual(
      stsCalls().map((call) => call.command.constructor.name),
      ["GetCallerIdentityCommand", "AssumeRoleCommand"],
    );
    assert.equal(
      (await s3Calls()[0].client.config.credentials()).accessKeyId,
      assumedCredentials.AccessKeyId,
    );
  });
}

for (const mode of ["auto", "assume-role"]) {
  test(`${mode} rejects a missing target ARN before contacting AWS`, async () => {
    config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = mode;
    config.SEMANTIC_MODEL_GUIDE_ROLE_ARN = undefined;
    await assert.rejects(readModelCatalogueSource(), /require a role ARN/);
    assert.equal(calls.length, 0);
  });
}

test("auto rejects malformed target ARNs before contacting AWS", async () => {
  config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = "auto";
  config.SEMANTIC_MODEL_GUIDE_ROLE_ARN = "not-a-role-arn";
  await assert.rejects(readModelCatalogueSource(), /valid IAM role ARN/);
  assert.equal(calls.length, 0);
});

test("auto rejects incomplete caller identity without assuming a role", async () => {
  config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = "auto";
  identity = {};
  await assert.rejects(readModelCatalogueSource(), /Unable to load semantic model catalogue/);
  assert.equal(stsCalls().length, 1);
  assert.equal(s3Calls().length, 0);
  assert.equal(destroyed.length, 1);
});

test("auto identity failures never fall back to direct S3 or another role", async () => {
  config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = "auto";
  stsFailure = Object.assign(new Error("private credentials detail"), {
    name: "InvalidClientTokenId",
  });
  await assert.rejects(readModelCatalogueSource(), (error) => {
    assert.match(error.message, /\(InvalidClientTokenId\)/);
    assert.doesNotMatch(error.message, /private credentials detail/);
    return error.status === 503;
  });
  assert.equal(stsCalls().length, 1);
  assert.equal(s3Calls().length, 0);
  assert.equal(destroyed.length, 1);
});

test("failed role assumption never falls back to the source identity", async () => {
  stsFailure = denied();
  await assert.rejects(readModelCatalogueSource(), /\(AccessDenied\)/);
  assert.equal(s3Calls().length, 0);
  assert.equal(destroyed.length, 1);
});

test("auto never retries direct access when the selected role assumption is denied", async () => {
  config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = "auto";
  identity = {
    Account: "123456789012",
    Arn: "arn:aws:sts::123456789012:assumed-role/other/session",
  };
  const send = STSClient.prototype.send;
  mock.method(STSClient.prototype, "send", async function (command, options) {
    if (command instanceof AssumeRoleCommand) {
      calls.push({ service: "sts", command, options, client: this });
      throw denied();
    }
    return send.call(this, command, options);
  });
  await assert.rejects(readModelCatalogueSource(), /\(AccessDenied\)/);
  assert.equal(stsCalls().length, 2);
  assert.equal(s3Calls().length, 0);
  assert.equal(destroyed.length, 1);
});

test("pod mode ignores a configured target instead of changing identities", async () => {
  config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = "pod";
  config.SEMANTIC_MODEL_GUIDE_ROLE_ARN = "unused-in-pod-mode";
  await loadAndCheck();
  assert.equal(stsCalls().length, 0);
});

test("incomplete temporary credentials fail before S3 access", async () => {
  incompleteCredentials = true;
  await assert.rejects(readModelCatalogueSource(), /Unable to load semantic model catalogue/);
  assert.equal(s3Calls().length, 0);
  assert.equal(destroyed.length, 1);
});

for (const mode of ["pod", "auto", "assume-role"]) {
  test(`${mode} S3 denial never changes identity or falls back to bundled files`, async () => {
    config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = mode;
    s3Failure = denied();
    await assert.rejects(readModelCatalogueSource(), (error) => {
      assert.match(error.message, /\(AccessDenied\)/);
      assert.doesNotMatch(error.message, /private AWS detail/);
      return error.code === "CONFIGURATION_ERROR";
    });
    assert.equal(s3Calls().length, 1);
    assert.equal(stsCalls().length, mode === "pod" ? 0 : 1);
    assert.equal(destroyed.length, mode === "pod" ? 1 : 2);
  });
}

test("file mode never constructs or calls an AWS client", async () => {
  config.SEMANTIC_MODEL_GUIDE_SOURCE = "file";
  config.SEMANTIC_MODEL_GUIDE_AUTH_MODE = "auto";
  config.SEMANTIC_MODEL_GUIDE_ROLE_ARN = undefined;
  config.SEMANTIC_MODEL_POLICY_PATH = undefined;
  config.SEMANTIC_MODEL_GUIDE_PATH = undefined;
  const result = await readModelCatalogueSource();
  assert.ok(result.policy.models.length > 0);
  assert.equal(calls.length, 0);
  assert.equal(destroyed.length, 0);
});

test("auth mode defaults compatibly and rejects unknown or blank values", () => {
  for (const mode of [undefined, "auto", "pod", "assume-role", "typo", ""]) {
    const childEnv = { ...process.env };
    if (mode === undefined) delete childEnv.SEMANTIC_MODEL_GUIDE_AUTH_MODE;
    else childEnv.SEMANTIC_MODEL_GUIDE_AUTH_MODE = mode;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `const { config } = await import(${JSON.stringify(new URL("../src/config/env.ts", import.meta.url).href)}); process.stdout.write(config.SEMANTIC_MODEL_GUIDE_AUTH_MODE);`,
      ],
      { env: childEnv, cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" },
    );
    if (mode === "typo" || mode === "") assert.notEqual(result.status, 0);
    else {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, mode ?? "assume-role");
    }
  }
});
