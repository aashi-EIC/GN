import { UpstreamError } from "../../errors.js";

export type SseEvent = { event: string; data: string };

export async function* readSse(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let line = "";
  let afterCR = false;
  let event = "message";
  let data: string[] = [];

  function consumeLine(): SseEvent | undefined {
    const current = line;
    line = "";
    if (!current) {
      const frame = data.length ? { event, data: data.join("\n") } : undefined;
      event = "message";
      data = [];
      return frame;
    }
    const colon = current.indexOf(":");
    const field = colon < 0 ? current : current.slice(0, colon);
    let value = colon < 0 ? "" : current.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value || "message";
    if (field === "data") data.push(value);
    return undefined;
  }

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        decoder.decode();
        break;
      }
      total += chunk.value.byteLength;
      if (total > maxBytes)
        throw new UpstreamError("MCP stream exceeded the configured size limit");
      for (const character of decoder.decode(chunk.value, { stream: true })) {
        if (afterCR && character === "\n") {
          afterCR = false;
          continue;
        }
        afterCR = character === "\r";
        if (character === "\r" || character === "\n") {
          const frame = consumeLine();
          if (frame) yield frame;
        } else {
          line += character;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
