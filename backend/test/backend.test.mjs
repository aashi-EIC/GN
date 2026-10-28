import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

// No private env files, hosted analytics requests or AWS calls are used by this suite.
Object.assign(process.env, {
  DOTENV_CONFIG_PATH: join(tmpdir(), "conv-bi-test-" + randomUUID()),
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  MONTHLY_TOKEN_LIMIT: "1000000",
  MAX_PROMPT_LENGTH: "20000",
  SESSION_CACHE_MAX_BYTES: "33554432",
  SESSION_CACHE_MAX_SESSIONS: "500",
  SESSION_CACHE_MAX_MESSAGES: "10000",
  SESSION_CACHE_TTL_MS: "86400000",
  SEMANTIC_MODEL_GUIDE_SOURCE: "file",
  SEMANTIC_MODEL_POLICY_PATH: fileURLToPath(
    new URL("../config/semantic-model-user-policy.json", import.meta.url),
  ),
  SEMANTIC_MODEL_GUIDE_PATH: fileURLToPath(
    new URL("../config/semantic-model-guide.json", import.meta.url),
  ),
  SEMANTIC_MODEL_GUIDE_EXCLUDED_IDS: "",
  MCP_AUTH_MODE: "none",
  MCP_REQUEST_PROMPT_FIELD: "message",
  MCP_REQUEST_SESSION_FIELD: "session_id",
  MCP_REQUEST_MODEL_FIELD: "semantic_model_id",
  MCP_REQUEST_USER_FIELD: "user_id",
  MCP_REQUEST_USER_VALUE_SOURCE: "browser_user_id",
  MCP_REQUEST_CORRELATION_FIELD: "",
  MCP_REQUEST_STATIC_FIELDS_JSON: '{"email":"test@example.com","bearer_token":""}',
  MCP_MODEL_ID_MAP_JSON: '{"schedule_completeness_tsg":"tsg"}',
  MCP_TIMEOUT_MS: "2000",
  MCP_MAX_RESPONSE_BYTES: "5242880",
  MCP_SAFE_RETRY_ENABLED: "false",
  MCP_MAX_RETRIES: "0",
  CHAT_STREAMING_ENABLED: "true",
  RATE_LIMIT_MAX: "1000",
  FEATURE_FLAGS_JSON: "{}",
  CORS_ALLOWED_ORIGINS: "http://test.local",
});
const servers = [];
async function serve(handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  servers.push(server);
  return "http://127.0.0.1:" + server.address().port;
}
after(() => {
  for (const server of servers) {
    server.closeAllConnections();
    server.close();
  }
});
let handler = (_req, res) => res.end();
process.env.MCP_BASE_URL = await serve((req, res) => handler(req, res));
process.env.MCP_ENDPOINT_PATH = "/chat";
process.env.MCP_STREAM_ENDPOINT_PATH = "/chat/stream";
const { config, assertRuntimeConfiguration } = await import("../src/config/env.ts");
const { parseMcpRequestConfiguration, setMcpField } =
  await import("../src/config/mcpRequestConfiguration.ts");
const { HttpMcpHostClient, readJsonResponse } =
  await import("../src/integrations/mcp/httpMcpHostClient.ts");
const { HttpMcpStreamClient } = await import("../src/integrations/mcp/httpMcpStreamClient.ts");
const { adaptMcpResponse } = await import("../src/integrations/mcp/mcpResponseAdapter.ts");
const { createSessionRepository } =
  await import("../src/persistence/repositories/sessionRepository.ts");
const { registerChatRequest, releaseChatRequest, cancelChatRequest } =
  await import("../src/application/services/chatRequestRegistry.ts");
const { readSse } = await import("../src/integrations/mcp/sse.ts");
const { app } = await import("../src/http/app.ts");
const bff = await serve(app);
const user = { tenantId: "test", objectId: "test", subject: "test", roles: [] };
const context = () => ({
  user,
  browserUserId: randomUUID(),
  prompt: "Compare channels",
  sessionId: randomUUID(),
  semanticModelId: "schedule_completeness_tsg",
  correlationId: randomUUID(),
});
const auth = { getHeaders: async () => ({ "x-test-key": "non-secret-sentinel" }) };
const upstreamError = (error) => error.code === "UPSTREAM_ERROR";

test("both transports reject redirects without forwarding authentication headers", async () => {
  let leaked = 0;
  const target = await serve((_req, res) => {
    leaked++;
    res.end();
  });
  handler = (_req, res) => {
    res.writeHead(307, { location: target });
    res.end();
  };
  const signal = new AbortController().signal;
  await assert.rejects(
    new HttpMcpHostClient(auth).send({}, user, randomUUID(), signal),
    upstreamError,
  );
  await assert.rejects(
    new HttpMcpStreamClient(auth).send(context(), signal, async () => {}),
    upstreamError,
  );
  assert.equal(leaked, 0);
});

test("rejected and oversized bodies are cancelled; reader locks are released", async () => {
  for (const headers of [
    { "content-type": "text/html" },
    {
      "content-type": "application/json",
      "content-length": String(config.MCP_MAX_RESPONSE_BYTES + 1),
    },
  ]) {
    let cancelled = false;
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array([1]));
      },
      cancel() {
        cancelled = true;
      },
    });
    await assert.rejects(readJsonResponse(new Response(body, { headers })), upstreamError);
    assert.equal(cancelled, true);
    assert.equal(body.locked, false);
  }
  let cancelled = false;
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(config.MCP_MAX_RESPONSE_BYTES + 1));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readJsonResponse(new Response(body, { headers: { "content-type": "application/json" } })),
    upstreamError,
  );
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
  const valid = new Response('{"answer":{"text":"ok"}}', {
    headers: { "content-type": "application/json" },
  });
  assert.equal((await readJsonResponse(valid)).answer.text, "ok");
  assert.equal(valid.body.locked, false);
  const invalid = new Response(new Uint8Array([0xff]), {
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(readJsonResponse(invalid), upstreamError);
  assert.equal(invalid.body.locked, false);
});

test("HTTP failures close response bodies before failing or retrying", async () => {
  const original = globalThis.fetch;
  let cancelled = 0,
    calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      if (calls === 2) {
        assert.equal(cancelled, 1);
        return new Response('{"answer":{"text":"ok"}}', {
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array([1]));
          },
          cancel() {
            cancelled++;
          },
        }),
        { status: 503 },
      );
    };
    await assert.rejects(
      new HttpMcpHostClient(auth).send({}, user, randomUUID(), new AbortController().signal),
      upstreamError,
    );
    assert.equal(cancelled, 1);
    calls = 0;
    cancelled = 0;
    config.MCP_SAFE_RETRY_ENABLED = true;
    config.MCP_MAX_RETRIES = 1;
    assert.equal(
      (await new HttpMcpHostClient(auth).send({}, user, randomUUID(), new AbortController().signal))
        .answer.text,
      "ok",
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
    config.MCP_SAFE_RETRY_ENABLED = false;
    config.MCP_MAX_RETRIES = 0;
  }
});

test("all response variants respect answer-length and row limits", () => {
  for (const input of [
    { answer: { text: "x".repeat(500001) } },
    { llm_output: "x".repeat(500001) },
    { response: "x".repeat(500001) },
    { llm_output: "ok", tool_result: [Array.from({ length: 10001 }, (_, index) => ({ index }))] },
  ])
    assert.throws(() => adaptMcpResponse(input), upstreamError);
  for (const input of [
    { answer: { text: "valid" } },
    { llm_output: "valid", tool_result: [[{ count: 1 }]] },
    { response: "valid" },
  ])
    assert.equal(adaptMcpResponse(input).answer.text, "valid");
  assert.equal(adaptMcpResponse({ llm_output: "x".repeat(500000) }).answer.text.length, 500000);
});

test("readiness rejects bad deployment mappings, endpoints and stream metadata", async () => {
  assert.doesNotThrow(assertRuntimeConfiguration);
  for (const overrides of [
    { MCP_REQUEST_STATIC_FIELDS_JSON: "not-json" },
    { MCP_MODEL_ID_MAP_JSON: '{"tsg":4}' },
    { MCP_REQUEST_PROMPT_FIELD: "__proto__.value" },
    { MCP_REQUEST_PROMPT_FIELD: "user_id" },
    { MCP_BASE_URL: "file:///tmp/test" },
    { MCP_ENDPOINT_PATH: "https://different.invalid/chat" },
    { MCP_STREAM_ENDPOINT_PATH: "https://different.invalid/stream" },
    { MCP_REQUEST_STATIC_FIELDS_JSON: '{"email":"not-an-email"}' },
  ]) {
    const saved = Object.fromEntries(Object.keys(overrides).map((key) => [key, config[key]]));
    Object.assign(config, overrides);
    try {
      assert.throws(assertRuntimeConfiguration, (error) => error.code === "CONFIGURATION_ERROR");
      assert.equal((await fetch(bff + "/api/v1/health/ready")).status, 503);
    } finally {
      Object.assign(config, saved);
    }
  }
  assert.equal((await fetch(bff + "/api/v1/health/ready")).status, 200);
  const prepared = parseMcpRequestConfiguration({
    MCP_REQUEST_PROMPT_FIELD: "context.message",
    MCP_REQUEST_STATIC_FIELDS_JSON: '{"context":{"email":"test@example.com"}}',
  });
  const body = structuredClone(prepared.staticBody);
  setMcpField(body, "context.message", "first");
  assert.equal(prepared.staticBody.context.message, undefined);
});

test("malformed JSON and misspelled booleans are rejected during module initialization", () => {
  const url = new URL("../src/config/env.ts", import.meta.url).href;
  const script =
    "try { await import(" +
    JSON.stringify(url) +
    "); } catch(error) { process.stdout.write(error.code); process.exitCode=1; }";
  for (const overrides of [
    { MCP_MODEL_ID_MAP_JSON: "not-json" },
    { CHAT_STREAMING_ENABLED: "tru" },
  ]) {
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        env: { ...process.env, ...overrides },
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
      },
    );
    assert.equal(child.status, 1);
    assert.match(child.stdout, /CONFIGURATION_ERROR/);
  }
});

test("duplicate request IDs cannot overwrite or release another active controller", () => {
  const id = randomUUID(),
    first = registerChatRequest(id, user);
  assert.throws(
    () => registerChatRequest(id, user),
    (error) => error.code === "CONFLICT",
  );
  releaseChatRequest(id, new AbortController());
  assert.equal(cancelChatRequest(id, { ...user, objectId: "other" }), false);
  assert.equal(cancelChatRequest(id, user), true);
  assert.equal(first.signal.aborted, true);
  assert.equal(cancelChatRequest(id, user), false);
  assert.throws(
    () => registerChatRequest(id, user),
    (error) => error.code === "CONFLICT",
  );
  releaseChatRequest(id, first);
  const second = registerChatRequest(id, user);
  releaseChatRequest(id, first);
  assert.equal(cancelChatRequest(id, user), true);
  releaseChatRequest(id, second);
});

const limits = { maxBytes: 1000000, maxSessions: 5, maxMessages: 1000, ttlMs: 1000 };
async function complete(repo, id, text = "test", correlationId = randomUUID()) {
  const message = await repo.ensureOwnedSession({
    id,
    user,
    semanticModelId: "tsg",
    prompt: "question",
    correlationId,
  });
  try {
    await repo.saveAssistantMessage(id, correlationId, { answer: { text } });
  } finally {
    repo.releaseSessionRequest(id, correlationId);
  }
  return message;
}

test("session cache bounds bytes, global message count and per-session history", async () => {
  const repo = createSessionRepository({ ...limits, maxBytes: 5000, maxMessages: 3 }),
    id = randomUUID();
  const oldest = await complete(repo, id, "x".repeat(100));
  for (let i = 0; i < 8; i++) await complete(repo, id, "x".repeat(100));
  const cached = await repo.getOwnedSession(user, id);
  assert.ok(cached.messages.length <= 3);
  assert.ok(
    cached.messages.reduce((sum, record) => sum + JSON.stringify(record).length * 2 + 256, 0) <=
      5000,
  );
  await assert.rejects(
    repo.assertOwnedMessage(user, oldest),
    (error) => error.code === "NOT_FOUND",
  );
  await complete(repo, id, "x".repeat(10000));
  assert.ok((await repo.getOwnedSession(user, id)).messages.length <= 3);
  const longer = createSessionRepository(limits);
  for (let i = 0; i < 60; i++) await complete(longer, id);
  assert.equal((await longer.getOwnedSession(user, id)).messages.length, 100);
});

test("cache eviction protects active sessions; TTL and deletion remove their messages", async () => {
  let now = 0;
  const repo = createSessionRepository({ ...limits, maxSessions: 1, ttlMs: 10 }, () => now),
    id = randomUUID(),
    correlationId = randomUUID();
  const message = await repo.ensureOwnedSession({
    id,
    user,
    semanticModelId: "tsg",
    prompt: "pending",
    correlationId,
  });
  now = 20;
  repo.prune();
  assert.equal((await repo.listOwnedSessions({ user, limit: 50 })).sessions.length, 1);
  await assert.rejects(
    repo.createOwnedSession({ user, semanticModelId: "tsg", title: "next" }),
    (error) => error.code === "SESSION_CACHE_FULL",
  );
  repo.releaseSessionRequest(id, correlationId);
  await assert.rejects(repo.getOwnedSession(user, id), (error) => error.code === "NOT_FOUND");
  await assert.rejects(
    repo.assertOwnedMessage(user, message),
    (error) => error.code === "NOT_FOUND",
  );
  const old = await repo.createOwnedSession({ user, semanticModelId: "tsg", title: "old" });
  const current = await repo.createOwnedSession({ user, semanticModelId: "tsg", title: "new" });
  await assert.rejects(repo.getOwnedSession(user, old.id), (error) => error.code === "NOT_FOUND");
  const saved = await complete(repo, current.id);
  await assert.rejects(
    repo.getOwnedSession({ ...user, objectId: "other" }, current.id),
    (error) => error.code === "NOT_FOUND",
  );
  await repo.deleteOwnedSession(user, current.id);
  await assert.rejects(repo.assertOwnedMessage(user, saved), (error) => error.code === "NOT_FOUND");
  assert.equal((await repo.listOwnedSessions({ user, limit: 50 })).sessions.length, 0);
});

test("oversized JSON returns 413, malformed JSON returns 400, neither calls MCP", async () => {
  let calls = 0;
  handler = (_req, res) => {
    calls++;
    res.end();
  };
  const oversized = await fetch(bff + "/api/v1/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "x".repeat(270000) }),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, "PAYLOAD_TOO_LARGE");
  const malformed = await fetch(bff + "/api/v1/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal(calls, 0);
});

test("normal and streaming BFF requests preserve model mappings, usage and completion", async () => {
  handler = async (req, res) => {
    const parts = [];
    for await (const part of req) parts.push(part);
    assert.equal(JSON.parse(Buffer.concat(parts).toString()).semantic_model_id, "tsg");
    const usage = { total_prompt_tokens: 12, total_completion_tokens: 8, total_tokens: 20 };
    if (req.url === "/chat/stream") {
      res.writeHead(200, { "content-type": "text/event-stream" });
      for (const event of [
        { event: "status", stage: "classifying" },
        { event: "token", token: "Streamed answer" },
        {
          event: "done",
          data: {
            session_id: "mcp-test",
            message_count: 2,
            session_status: "active",
            token_usage: usage,
          },
        },
      ])
        res.write("event: " + event.event + "\ndata: " + JSON.stringify(event) + "\n\n");
      res.end();
    } else {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ llm_output: "Normal answer", token_usage: usage }));
    }
  };
  const identity = randomUUID();
  for (const streaming of [false, true]) {
    const response = await fetch(bff + "/api/v1/chat" + (streaming ? "/stream" : ""), {
      method: "POST",
      headers: { "content-type": "application/json", "x-browser-user-id": identity },
      body: JSON.stringify({
        session_id: randomUUID(),
        semantic_model_id: "schedule_completeness_tsg",
        prompt: "Compare channels",
      }),
    });
    assert.equal(response.status, 200);
    if (streaming) {
      const events = [];
      for await (const event of readSse(response.body, 100000)) events.push(event);
      const completed = JSON.parse(events.find((event) => event.event === "complete").data);
      assert.equal(completed.answer.text, "Streamed answer");
      assert.equal(completed.token_usage.total_tokens, 20);
      assert.ok(events.some((event) => event.event === "text_delta"));
    } else {
      const completed = await response.json();
      assert.equal(completed.answer.text, "Normal answer");
      assert.equal(completed.token_usage.total_tokens, 20);
    }
  }
  const quota = await (
    await fetch(bff + "/api/v1/usage/monthly", { headers: { "x-browser-user-id": identity } })
  ).json();
  assert.equal(quota.used, 40);
  assert.equal(quota.pending_requests, 0);
});
