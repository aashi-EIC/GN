import { env } from "../../../shared/config/env";
import { bffClient } from "../../../shared/services/axios";
import { getAuthToken } from "../../../shared/services/tokenStore";
import { getBrowserUserId } from "../../../shared/utils/browserIdentity";
import type { McpRequestPayload } from "../../../shared/types/app";
import type { ChatResponse } from "./mcp.service";

export type StreamCallbacks = {
  onStatus?: (message: string) => void;
  onSession?: (sessionId: string) => void;
  onTextDelta?: (text: string) => void;
};

function readStreamErrorMessage(record: Record<string, unknown>): string | undefined {
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }
  const errorObj = record.error;
  if (errorObj && typeof errorObj === "object") {
    const errorRec = errorObj as Record<string, unknown>;
    if (typeof errorRec.message === "string" && errorRec.message.trim()) {
      return errorRec.message.trim();
    }
  }
  return undefined;
}

export async function isChatStreamingAvailable() {
  try {
    const response = await bffClient.get<{ streaming?: unknown }>("/chat/capabilities", {
      timeout: 1500,
    });
    return response.data.streaming === true;
  } catch {
    // Safe fallback BEFORE submitting an analytical request; older BFFs have no capability route.
    return false;
  }
}

/** Live answer deltas are transient; completion remains authoritative for saved history. */
export async function requestStreamingChat(
  payload: McpRequestPayload,
  callbacks: StreamCallbacks,
): Promise<ChatResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), env.apiTimeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "text/event-stream",
      "x-browser-user-id": getBrowserUserId(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    };
    const response = await fetch(`${env.apiBaseUrl.replace(/\/$/, "")}/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (
      !response.ok ||
      !response.body ||
      !/^text\/event-stream(?:\s*;|\s*$)/i.test(response.headers.get("content-type") ?? "")
    ) {
      await response.body?.cancel();
      throw new Error("The middleware did not accept the streaming request. Please try again.");
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let pending = "";
    let bytes = 0;
    let answerLength = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        decoder.decode();
        throw new Error("The response stream ended before completion. Please try again.");
      }
      bytes += chunk.value.byteLength;
      if (bytes > 10_485_760) throw new Error("The streamed response exceeded the size limit.");
      // Our BFF emits LF-delimited, single-line JSON data. HTTP chunks may split anywhere.
      pending += decoder.decode(chunk.value, { stream: true });
      let boundary: number;
      while ((boundary = pending.indexOf("\n\n")) !== -1) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const lines = frame.split("\n");
        const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
        const data = lines.find((line) => line.startsWith("data: "))?.slice(6);
        if (!event || data === undefined) continue; // Heartbeat comment.
        let value: unknown;
        try {
          value = JSON.parse(data);
        } catch {
          throw new Error("The middleware returned an invalid stream event.");
        }
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error("The middleware returned an invalid stream event.");
        }
        const record = value as Record<string, unknown>;
        if (event === "error") {
          const apiMessage = readStreamErrorMessage(record);
          throw new Error(
            apiMessage ??
              "The analytics engine was unable to process this request. Please try asking a metric-focused question for your selected model.",
          );
        }
        if (event === "text_delta") {
          if (typeof record.text !== "string" || (answerLength += record.text.length) > 500_000) {
            throw new Error("The middleware returned an invalid text delta.");
          }
          callbacks.onTextDelta?.(record.text);
        }
        if (
          event === "status" &&
          typeof record.message === "string" &&
          record.message.length <= 100
        ) {
          callbacks.onStatus?.(record.message);
        }
        if (
          event === "session" &&
          typeof record.session_id === "string" &&
          record.session_id.length <= 256
        ) {
          callbacks.onSession?.(record.session_id);
        }
        if (event === "complete") {
          if (
            !record.answer ||
            typeof record.answer !== "object" ||
            !("text" in record.answer) ||
            typeof record.answer.text !== "string" ||
            !record.answer.text.trim()
          ) {
            throw new Error("The middleware returned an invalid stream completion.");
          }
          return record as ChatResponse;
        }
      }
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The analysis took too long. Please try again.");
    if (error instanceof TypeError)
      throw new Error("The middleware is unavailable. Check that the BFF is running.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
    controller.abort();
  }
}
