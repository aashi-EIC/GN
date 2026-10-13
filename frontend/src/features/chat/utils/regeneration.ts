import type { Message } from "../../../shared/types/app";

export function replaceAssistantResponse(
  messages: Message[],
  responseId: string,
  replacement: Message,
): Message[] {
  return messages.map((message) =>
    message.id === responseId && message.role === "assistant"
      ? { ...replacement, id: message.id }
      : message,
  );
}
