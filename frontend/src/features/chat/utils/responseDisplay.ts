import type { Conversation, Message, TablePageSize } from "../../../shared/types/app";

export function removeChartScriptSections(text: string) {
  const withoutDuplicateArraySections = text.replace(
    /(?:^|\r?\n)\s*(?:#{1,6}\s*)?2\s*[- ]?d(?:imensional)?\s+array(?:\s+format)?\s*:?\s*\r?\n\s*```(?:[a-z][\w-]*)?\s*\r?\n[\s\S]*?```/gim,
    "\n",
  );

  const withoutNamedChartSections = withoutDuplicateArraySections
    .replace(
      /(?:^|\r?\n)\s*(?:#{1,6}\s*)?(?:[📊📈📉🥧]\uFE0F?\s*)?[^\r\n]*(?:chart|graph)[^\r\n]*\r?\n\s*```(?:[a-z][\w-]*)?\s*\r?\n[\s\S]*?```/gim,
      "\n",
    )
    .replace(
      /(?:^|\r?\n)\s*(?:#{1,6}\s*)?[📊📈📉🥧]\uFE0F?[^\r\n]*\r?\n\s*```(?:[a-z][\w-]*)?\s*\r?\n[\s\S]*?```/gim,
      "\n",
    )
    .replace(
      /(?:^|\r?\n)(?:#{1,6}\s+[^\r\n]*(?:chart|graph)[^\r\n]*\r?\n\s*)?```(?:[a-z][\w-]*)?\s*\r?\n\s*(?:chartType|chart_type|chart)\s*:\s*(?:pie|donut|bar|line|area|scatter|radar|heatmap|treemap|funnel|gauge|waterfall|bubble|histogram|boxplot|horizontal-bar|stacked-bar)\s*\r?\n[\s\S]*?```/gim,
      "\n",
    );

  return withoutNamedChartSections
    .replace(/```(?:[a-z][\w-]*)?\s*\r?\n[\s\S]*?```/gim, (block) =>
      isChartDirectiveBlock(block) || isAsciiChartBlock(block) ? "\n" : block,
    )
    .replace(
      /(?:^|\r?\n)\s*(?:#{1,6}\s+|[📊📈📉🥧]\uFE0F?\s*)[^\r\n]*(?:chart|graph)[^\r\n]*(?=\r?\n|$)/gim,
      "\n",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isChartDirectiveBlock(block: string) {
  const content = block
    .replace(/^```[^\r\n]*\r?\n/, "")
    .replace(/```$/, "")
    .trim();
  return /^(?:chartType|chart_type|chart)\s*:\s*(?:pie|donut|bar|line|area|scatter|radar|heatmap|treemap|funnel|gauge|waterfall|bubble|histogram|boxplot|horizontal-bar|stacked-bar)\b/i.test(
    content,
  );
}

function isAsciiChartBlock(block: string) {
  const content = block.replace(/^```[^\r\n]*\r?\n/, "").replace(/```$/, "");
  const dataLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (dataLines.length < 2) return false;

  const barLines = dataLines.filter(
    (line) => /[█▓▒░▉▊▋▌▍▎▏]{2,}/u.test(line) && /\d+(?:\.\d+)?\s*%/.test(line),
  );

  return barLines.length >= 2 && barLines.length >= Math.ceil(dataLines.length / 2);
}

export function normalizeStoredConversation(
  conversation: Conversation,
  fallbackTablePageSize: TablePageSize = 5,
): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      normalizeStoredMessage(message, fallbackTablePageSize),
    ),
  };
}

function normalizeStoredMessage(message: Message, fallbackTablePageSize: TablePageSize): Message {
  if (message.role !== "assistant") return message;

  const text = removeChartScriptSections(message.text);
  const tablePageSize =
    typeof message.tablePageSize === "number" && Number.isFinite(message.tablePageSize)
      ? Math.min(100, Math.max(1, Math.trunc(message.tablePageSize)))
      : fallbackTablePageSize;
  if (
    text === message.text &&
    !message.visualizations?.length &&
    message.tablePageSize === tablePageSize
  ) {
    return message;
  }

  return { ...message, text, tablePageSize, visualizations: undefined };
}
