export function createId(prefix: string) {
  if ("randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createSessionId() {
  if ("randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function isSessionId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function titleFromQuestion(question: string) {
  const compact = question.replace(/\s+/g, " ").trim();
  return compact.length > 48 ? `${compact.slice(0, 45)}...` : compact;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "during",
  "each",
  "find",
  "for",
  "from",
  "get",
  "give",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "info",
  "information",
  "into",
  "is",
  "it",
  "its",
  "just",
  "list",
  "me",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "please",
  "show",
  "shows",
  "some",
  "tell",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "under",
  "up",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

export function titleFromUserMessages(userMessages: string[]): string {
  const topMessages = userMessages.filter((m) => m && m.trim().length > 0).slice(0, 5);
  if (topMessages.length === 0) return "new chat";

  const wordCounts: Map<string, number> = new Map();
  const orderedWords: string[] = [];

  for (const msg of topMessages) {
    const words = msg
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    for (const lower of words) {
      wordCounts.set(lower, (wordCounts.get(lower) || 0) + 1);
      if (!orderedWords.includes(lower)) {
        orderedWords.push(lower);
      }
    }
  }

  if (orderedWords.length === 0) {
    const rawFallback = topMessages[0].trim().split(/\s+/).slice(0, 2);
    return rawFallback.join(" ").toLowerCase() || "new chat";
  }

  const sortedWords = [...orderedWords].sort((a, b) => {
    const countA = wordCounts.get(a) || 0;
    const countB = wordCounts.get(b) || 0;
    if (countA !== countB) return countB - countA;
    return orderedWords.indexOf(a) - orderedWords.indexOf(b);
  });

  return sortedWords.slice(0, 3).join(" ").toLowerCase();
}
