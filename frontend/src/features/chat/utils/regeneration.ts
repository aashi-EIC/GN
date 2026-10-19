import type { Message } from "../../../shared/types/app";

type SavedTurn = { user: Message; answers: Message[] };

function journeyKey(message: Message) {
  return message.history?.journeyId
    ? JSON.stringify([message.history.sessionId, message.history.journeyId])
    : undefined;
}

function splitTurns(messages: Message[]) {
  const turns: SavedTurn[] = [];
  const byId = new Map<string, SavedTurn>();
  const byJourney = new Map<string, SavedTurn[]>();
  for (const message of messages) {
    if (message.role !== "user") continue;
    const turn = { user: message, answers: [] };
    turns.push(turn);
    byId.set(message.id, turn);
    const key = journeyKey(message);
    if (key) {
      const group = byJourney.get(key) ?? [];
      group.push(turn);
      byJourney.set(key, group);
    }
  }
  const leading: Message[] = [];
  let previous: SavedTurn | undefined;
  for (const message of messages) {
    if (message.role === "user") {
      previous = byId.get(message.id);
      continue;
    }
    const key = journeyKey(message);
    const candidates = key ? byJourney.get(key) : undefined;
    // Reassociate cached answers only when their journey identifies a unique turn.
    const turn = candidates?.length === 1 ? candidates[0] : previous;
    if (turn) turn.answers.push(message);
    else leading.push(message);
  }
  return {
    turns: turns.map((turn) =>
      turn.answers.some((answer) => answer.text.trim())
        ? { ...turn, answers: turn.answers.filter((answer) => answer.text.trim()) }
        : turn,
    ),
    leading,
  };
}

function sameSavedMessage(local: Message, remote: Message) {
  if (local.history?.sessionId !== remote.history?.sessionId) return false;
  if (local.history?.messageId && remote.history?.messageId) {
    return local.history.messageId === remote.history.messageId;
  }
  return Boolean(
    local.history?.journeyId &&
    local.history.journeyId === remote.history?.journeyId &&
    local.role === remote.role,
  );
}

function sourceKey(source: Message["history"]) {
  return source?.messageId
    ? JSON.stringify([source.sessionId, "message", source.messageId])
    : source?.journeyId
      ? JSON.stringify([source.sessionId, "journey", source.journeyId])
      : undefined;
}

function collapseRegenerationTurns(turns: SavedTurn[], references: SavedTurn[] = []) {
  const result: SavedTurn[] = [];
  for (const turn of turns) {
    const key = sourceKey(turn.user.history);
    const reference =
      turn.user.requestKind === "new"
        ? undefined
        : references.find((candidate) => {
            if (candidate.user.text !== turn.user.text) return false;
            if (
              key &&
              candidate.user.regenerationSources?.some((source) => sourceKey(source) === key)
            )
              return true;
            const created = Date.parse(turn.user.createdAt);
            return candidate.user.regenerationAttempts?.some((attempt) => {
              const start = Date.parse(attempt.startedAt);
              const end = attempt.completedAt ? Date.parse(attempt.completedAt) : start + 300_000;
              return (
                created >= start - 1_000 &&
                created <= end + 1_000 &&
                !sameSavedMessage(candidate.user, turn.user)
              );
            });
          });
    let target = reference
      ? result.find(
          (candidate) =>
            candidate.user.id === reference.user.id ||
            sameSavedMessage(candidate.user, reference.user) ||
            (!reference.user.history && candidate.user.text === reference.user.text),
        )
      : undefined;
    const previous = result.at(-1);
    const missingAnswer = !turn.answers.some((answer) => answer.text.trim());
    // Without a regeneration flag, group only consecutive imported duplicates
    // with empty answers. Explicit submissions and completed turns remain distinct.
    if (
      !target &&
      previous &&
      missingAnswer &&
      previous.user.text === turn.user.text &&
      turn.user.requestKind !== "new" &&
      (turn.user.history || turn.user.id.startsWith("history-")) &&
      (previous.answers.some((answer) => answer.text.trim()) ||
        previous.user.regenerationSources?.length ||
        references.some(
          (candidate) =>
            sameSavedMessage(candidate.user, previous.user) &&
            candidate.answers.some((answer) => answer.text.trim()),
        ))
    ) {
      target = previous;
    }
    if (!target) {
      result.push({ ...turn });
      continue;
    }
    const sources = [
      ...(target.user.regenerationSources ?? []),
      ...(turn.user.regenerationSources ?? []),
      ...(turn.user.history ? [turn.user.history] : []),
    ];
    const unique = new Map(sources.map((source) => [sourceKey(source), source]));
    target.user = { ...target.user, regenerationSources: [...unique.values()] };
    // Empty attempts must not replace a completed answer in the local transcript.
    if (!missingAnswer) target.answers = turn.answers;
  }
  return result;
}

export function collapseRegenerationMessages(messages: Message[]): Message[] {
  const parsed = splitTurns(messages);
  const turns = collapseRegenerationTurns(parsed.turns, parsed.turns);
  return [...parsed.leading, ...turns.flatMap((turn) => [turn.user, ...turn.answers])];
}

export function replaceAssistantResponse(
  messages: Message[],
  responseId: string,
  replacement: Message,
): Message[] {
  return messages.map((message) =>
    message.id === responseId && message.role === "assistant"
      ? { ...replacement, id: message.id, history: message.history }
      : message,
  );
}

export function recordRegenerationAttempt(
  messages: Message[],
  userId: string,
  requestId: string,
  startedAt: string,
  completedAt?: string,
): Message[] {
  return messages.map((message) => {
    if (message.id !== userId || message.role !== "user") return message;
    const attempts = message.regenerationAttempts ?? [];
    const existing = attempts.find((attempt) => attempt.id === requestId);
    return {
      ...message,
      regenerationAttempts: existing
        ? attempts.map((attempt) =>
            attempt.id === requestId
              ? { ...attempt, ...(completedAt ? { completedAt } : {}) }
              : attempt,
          )
        : [...attempts, { id: requestId, startedAt, ...(completedAt ? { completedAt } : {}) }],
    };
  });
}
