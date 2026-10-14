import { z } from "zod";
import { config, getRequired } from "../../config/env.js";
import { ConfigurationError, UpstreamError } from "../../errors.js";
import type { McpRequestContext } from "../../types.js";
import type { OutboundAuthenticationProvider } from "./authenticationProvider.js";
import { adaptMcpRequest } from "./mcpRequestAdapter.js";
import { readSse } from "./sse.js";

export type StreamProgress =
  | { event: "status"; data: { message: string } }
  | { event: "text_delta"; data: { text: string } }
  | { event: "session"; data: { session_id: string } };
export type StreamProgressHandler = (progress: StreamProgress) => Promise<void>;

const envelope = z.object({
  event: z.string().optional(),
  stage: z.string().nullable().optional(),
  token: z.string().nullable().optional(),
  data: z.unknown().optional(),
});
const metadata = z.object({
  session_id: z.string().trim().min(1).max(256),
  message_count: z.number().int().nonnegative(),
  session_status: z.string().trim().min(1).max(100),
  generated_dax_query: z.array(z.unknown()).max(100).optional(),
  tool_result: z.array(z.unknown()).max(100).optional(),
  expected_format: z.string().max(100).optional(),
});
const requestBody = z.object({
  user_id: z.string().trim().min(1).max(256),
  email: z.string().email(),
  bearer_token: z.string().optional(),
  message: z.string().min(1).max(config.MAX_PROMPT_LENGTH),
  semantic_model_id: z.string().min(1).max(256),
  session_id: z.string().min(1).max(256).optional(),
});

export class HttpMcpStreamClient {
  constructor(private readonly authentication: OutboundAuthenticationProvider) { }

  async send(context: McpRequestContext, signal: AbortSignal, emit: StreamProgressHandler) {
    if (!config.CHAT_STREAMING_ENABLED) throw new ConfigurationError("Chat streaming is disabled");
    const base = new URL(getRequired("MCP_BASE_URL"));
    const url = new URL(config.MCP_STREAM_ENDPOINT_PATH, base);
    if (url.origin !== base.origin) {
      throw new ConfigurationError("MCP_STREAM_ENDPOINT_PATH must remain on MCP_BASE_URL origin");
    }
    const mapped = adaptMcpRequest(context);
    const parsed = requestBody.safeParse({
      ...mapped,
      user_id: context.browserUserId,
      email: mapped.email ?? config.MCP_STREAM_EMAIL,
      bearer_token: mapped.bearer_token ?? "",
      message: context.prompt,
      semantic_model_id: mapped.semantic_model_id ?? context.semanticModelId,
      ...(context.mcpSessionId ? { session_id: context.mcpSessionId } : {}),
    });
    if (!parsed.success)
      throw new ConfigurationError("Invalid MCP streaming request configuration");
    const timeoutSignal = AbortSignal.timeout(config.MCP_TIMEOUT_MS);
    const requestSignal = AbortSignal.any([signal, timeoutSignal]);
    let text = "";
    let sessionId: string | undefined;
    let writing = false;
    try {
      const headers = await this.authentication.getHeaders(context.user, requestSignal);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          accept: "text/event-stream",
          "x-correlation-id": context.correlationId,
        },
        body: JSON.stringify(parsed.data),
        signal: requestSignal,
      });
      if (
        !response.ok ||
        !response.body ||
        !/^text\/event-stream(?:\s*;|\s*$)/i.test(response.headers.get("content-type") ?? "")
      ) {
        await response.body?.cancel();
        throw new UpstreamError("MCP host did not return a successful event stream", {
          upstreamStatus: response.status,
        });
      }
      for await (const frame of readSse(response.body, config.MCP_MAX_RESPONSE_BYTES)) {
        requestSignal.throwIfAborted();
        if (!["status", "token", "done", "error"].includes(frame.event)) continue;
        let raw: unknown;
        try {
          raw = JSON.parse(frame.data);
        } catch {
          throw new UpstreamError("MCP stream returned invalid JSON");
        }
        const checked = envelope.safeParse(raw);
        if (!checked.success) throw new UpstreamError("MCP stream returned an invalid event");
        const value = checked.data;
        if (value.event && value.event !== frame.event) {
          throw new UpstreamError("MCP stream returned a conflicting event type");
        }
        if (frame.event === "error") throw new UpstreamError("MCP streaming analysis failed");
        if (frame.event === "status") {
          if (value.stage === "session_ready") {
            const session = z
              .object({ session_id: z.string().trim().min(1).max(256) })
              .safeParse(value.data);
            if (!session.success)
              throw new UpstreamError("MCP stream returned invalid session metadata");
            sessionId = session.data.session_id;
            await emit({ event: "session", data: session.data });
          }
          await emit({
            event: "status",
            data: { message: writing ? "Writing your response" : "Analyzing your data" },
          });
        } else if (frame.event === "token") {
          if (typeof value.token !== "string")
            throw new UpstreamError("MCP stream returned an invalid text token");
          text += value.token;
          if (text.length > 500_000)
            throw new UpstreamError("MCP streamed answer exceeded the size limit");
          if (!writing && text.trim()) {
            writing = true;
            await emit({ event: "status", data: { message: "Writing your response" } });
          }
          if (value.token) await emit({ event: "text_delta", data: { text: value.token } });
        } else if (frame.event === "done") {
          const final = metadata.safeParse(value.data);
          if (
            !final.success ||
            !text.trim() ||
            (sessionId && final.data.session_id !== sessionId)
          ) {
            throw new UpstreamError("MCP stream returned an invalid completion");
          }
          requestSignal.throwIfAborted();
          return { ...final.data, llm_output: text };
        }
      }
      throw new UpstreamError("MCP stream ended before completion");
    } catch (error) {
      if (signal.aborted) throw new UpstreamError("Request was cancelled", undefined, 499);
      if (timeoutSignal.aborted)
        throw new UpstreamError("MCP streaming analysis took too long", undefined, 504);
      if (error instanceof UpstreamError || error instanceof ConfigurationError) throw error;
      throw new UpstreamError("MCP streaming connection failed");
    }
  }
}
