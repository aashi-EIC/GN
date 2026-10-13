import type { Conversation, Message } from "../../../shared/types/app";
import { storageKeys } from "../../../shared/config/storage";
import { isSessionId } from "../../../shared/utils/session";
import { normalizeStoredConversation } from "../utils/responseDisplay";

// Keep the old snapshot as a read-only baseline. New writes affect individual
// fields/messages, so two tabs never overwrite each other's entire history.
const prefix = `${storageKeys.conversations}:v2:`;
const metadataFields = [
  "title",
  "modelId",
  "countryCode",
  "createdAt",
  "updatedAt",
  "pinned",
  "mcpSessionId",
  "mcpMessageCount",
  "mcpSessionStatus",
] as const;
type MessagePosition = { order: number; tieBreaker: string };
type PositionedMessage = MessagePosition & { message: Message };
type HistoryUpdate = (current: Conversation[]) => Conversation[];

function parse(value: string | null): unknown {
  try {
    return value === null ? null : JSON.parse(value);
  } catch {
    return null;
  }
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<Message>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.text === "string" &&
    typeof message.createdAt === "string"
  );
}

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;
  const conversation = value as Partial<Conversation>;
  return (
    typeof conversation.id === "string" &&
    typeof conversation.title === "string" &&
    typeof conversation.modelId === "string" &&
    typeof conversation.createdAt === "string" &&
    typeof conversation.updatedAt === "string" &&
    Array.isArray(conversation.messages) &&
    conversation.messages.every(isMessage)
  );
}

// Older builds allowed non-UUID IDs. Map those deterministically so every tab
// refers to the same legacy chat. This is an identifier, not a security token.
function stableLegacyId(id: string) {
  const hex = [0, 1, 2, 3]
    .map((salt) => {
      let hash = 2166136261 ^ salt;
      for (const character of id) {
        hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, "0");
    })
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function conversationKey(id: string) {
  return `${prefix}${encodeURIComponent(id)}:`;
}

export function createConversationHistory(tablePageSize: number) {
  let snapshot: Conversation[] = [];
  const listeners = new Set<() => void>();
  // Failed storage writes stay in this tab's memory; optional persistence must
  // never prevent a request or discard the response being displayed.
  const unsaved = new Map<string, string>();
  let positions = new Map<string, Map<string, MessagePosition>>();

  function read(fallback: Conversation[]) {
    try {
      const entries = new Map<string, string>();
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix)) {
          const value = localStorage.getItem(key);
          if (value !== null) entries.set(key, value);
        }
      }
      for (const entry of unsaved) entries.set(...entry);
      const records = new Map<string, Map<string, string>>();
      for (const [key, value] of entries) {
        const boundary = key.indexOf(":", prefix.length) + 1;
        if (boundary === 0) continue;
        const conversationPrefix = key.slice(0, boundary);
        const record = records.get(conversationPrefix) ?? new Map<string, string>();
        record.set(key.slice(boundary), value);
        records.set(conversationPrefix, record);
      }

      const conversations = new Map<string, Conversation>();
      const legacy = parse(localStorage.getItem(storageKeys.conversations));
      if (Array.isArray(legacy)) {
        for (const conversation of legacy.filter(isConversation)) {
          const id = isSessionId(conversation.id)
            ? conversation.id
            : stableLegacyId(conversation.id);
          conversations.set(id, { ...conversation, id });
        }
      }
      for (const [key, raw] of entries) {
        if (!key.endsWith(":base")) continue;
        const conversation = parse(raw);
        if (isConversation(conversation) && key === `${conversationKey(conversation.id)}base`) {
          conversations.set(conversation.id, conversation);
        }
      }

      const nextPositions = new Map<string, Map<string, MessagePosition>>();
      const result = [...conversations.values()]
        .filter((conversation) => !entries.has(`${conversationKey(conversation.id)}deleted`))
        .map((conversation) => {
          const key = conversationKey(conversation.id);
          const record = records.get(key) ?? new Map<string, string>();
          const next = { ...conversation };
          for (const field of metadataFields) {
            const raw = record.get(`field:${field}`);
            if (raw !== undefined) {
              const value = parse(raw);
              const optional = !["title", "modelId", "createdAt", "updatedAt"].includes(field);
              const valid =
                field === "pinned"
                  ? typeof value === "boolean"
                  : field === "mcpMessageCount"
                    ? typeof value === "number" && Number.isInteger(value) && value >= 0
                    : typeof value === "string";
              if (valid || (optional && raw === "null")) {
                Object.assign(next, { [field]: value === null ? undefined : value });
              }
            }
          }
          const messages = new Map<string, PositionedMessage>(
            conversation.messages.map((message, order) => [
              message.id,
              { message, order, tieBreaker: message.createdAt },
            ]),
          );
          for (const [entryKey, raw] of record) {
            if (!entryKey.startsWith("message:")) continue;
            const value = parse(raw) as Partial<PositionedMessage> | null;
            if (
              value &&
              isMessage(value.message) &&
              typeof value.order === "number" &&
              Number.isFinite(value.order) &&
              entryKey === `message:${encodeURIComponent(value.message.id)}`
            ) {
              messages.set(value.message.id, {
                message: value.message,
                order: value.order,
                tieBreaker:
                  typeof value.tieBreaker === "string" ? value.tieBreaker : value.message.createdAt,
              });
            }
          }
          next.messages = [...messages.values()]
            .filter(({ message }) => !record.has(`removed:${encodeURIComponent(message.id)}`))
            .sort(
              (a, b) =>
                a.order - b.order ||
                a.tieBreaker.localeCompare(b.tieBreaker) ||
                a.message.id.localeCompare(b.message.id),
            )
            .map(({ message }) => message);
          nextPositions.set(
            conversation.id,
            new Map(
              [...messages].map(([id, { order, tieBreaker }]) => [id, { order, tieBreaker }]),
            ),
          );
          return normalizeStoredConversation(next, tablePageSize);
        });
      positions = nextPositions;
      return result;
    } catch {
      return fallback;
    }
  }

  function publish(next: Conversation[]) {
    // Retain unchanged objects so a remote sidebar edit does not remount or
    // redraw every answer, table, and regeneration animation in the current tab.
    const previous = new Map(snapshot.map((conversation) => [conversation.id, conversation]));
    next = next.map((conversation) => {
      const existing = previous.get(conversation.id);
      if (!existing) return conversation;
      if (JSON.stringify(existing) === JSON.stringify(conversation)) return existing;
      const messages = new Map(existing.messages.map((message) => [message.id, message]));
      return {
        ...conversation,
        messages: conversation.messages.map((message) => {
          const saved = messages.get(message.id);
          return saved && JSON.stringify(saved) === JSON.stringify(message) ? saved : message;
        }),
      };
    });
    if (
      next.length === snapshot.length &&
      next.every((value, index) => value === snapshot[index])
    ) {
      return;
    }
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function refresh() {
    publish(read(snapshot));
  }

  function write(key: string, value: unknown) {
    const raw = JSON.stringify(value);
    unsaved.set(key, raw);
    try {
      localStorage.setItem(key, raw);
      unsaved.delete(key);
    } catch {
      // Keep working with the in-memory copy when storage is blocked or full.
    }
  }

  function update(action: HistoryUpdate) {
    // Re-read immediately before computing the user's change, even if another
    // tab's storage event has not been delivered yet.
    const current = read(snapshot);
    const next = action(current);
    const before = new Map(current.map((conversation) => [conversation.id, conversation]));
    const after = new Map(next.map((conversation) => [conversation.id, conversation]));
    for (const conversation of current) {
      if (!after.has(conversation.id)) write(`${conversationKey(conversation.id)}deleted`, true);
    }
    for (const conversation of next) {
      const key = conversationKey(conversation.id);
      const existing = before.get(conversation.id);
      if (!existing) {
        write(`${key}base`, conversation);
        continue;
      }
      for (const field of metadataFields) {
        if (conversation[field] !== existing[field]) {
          write(`${key}field:${field}`, conversation[field] ?? null);
        }
      }
      const oldMessages = new Map(existing.messages.map((message) => [message.id, message]));
      const existingPositions = positions.get(conversation.id);
      let nextOrder = existing.messages.length;
      existingPositions?.forEach(({ order }) => {
        nextOrder = Math.max(nextOrder, order + 1);
      });
      const nextIds = new Set(conversation.messages.map((message) => message.id));
      for (const message of existing.messages) {
        if (!nextIds.has(message.id))
          write(`${key}removed:${encodeURIComponent(message.id)}`, true);
      }
      for (const [order, message] of conversation.messages.entries()) {
        if (JSON.stringify(message) !== JSON.stringify(oldMessages.get(message.id))) {
          const previous = oldMessages.get(message.id);
          const position = previous
            ? (existingPositions?.get(message.id) ?? { order, tieBreaker: previous.createdAt })
            : { order: nextOrder++, tieBreaker: message.createdAt };
          write(`${key}message:${encodeURIComponent(message.id)}`, { message, ...position });
        }
      }
    }
    publish(read(next));
  }

  snapshot = read([]);

  return {
    getSnapshot: () => snapshot,
    update,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect() {
      const onStorage = (event: StorageEvent) => {
        if (
          event.storageArea !== localStorage ||
          (event.key !== null &&
            event.key !== storageKeys.conversations &&
            !event.key.startsWith(prefix))
        )
          return;
        if (event.key === null) unsaved.clear();
        else unsaved.delete(event.key);
        refresh();
      };
      const onVisibility = () => {
        if (document.visibilityState === "visible") refresh();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener("focus", refresh);
      document.addEventListener("visibilitychange", onVisibility);
      refresh();
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("focus", refresh);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    },
  };
}
