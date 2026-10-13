import "./inlineVisualMarkers.css";

type MarkerDetails = {
  emoji: string;
  label: string;
  tone: "positive" | "negative" | "warning" | "info" | "accent" | "neutral";
};

const markerGroups: Array<MarkerDetails & { symbols: string[] }> = [
  {
    symbols: ["\u2b06", "\u{1f4c8}", "\u{1f53c}", "\u23eb", "\u{1f680}"],
    emoji: "📈",
    label: "Improving",
    tone: "positive",
  },
  {
    symbols: ["\u2b07", "\u{1f4c9}", "\u{1f53d}", "\u23ec"],
    emoji: "📉",
    label: "Declining",
    tone: "negative",
  },
  {
    symbols: ["\u26a0", "\u{1f6a8}", "\u2757", "\u2755"],
    emoji: "⚠️",
    label: "Needs attention",
    tone: "warning",
  },
  {
    symbols: ["\u2705", "\u2714", "\u2611"],
    emoji: "✅",
    label: "Completed",
    tone: "positive",
  },
  {
    symbols: ["\u274c", "\u2716", "\u26d4"],
    emoji: "❌",
    label: "Failed",
    tone: "negative",
  },
  {
    symbols: ["\u2139"],
    emoji: "ℹ️",
    label: "Information",
    tone: "info",
  },
  {
    symbols: ["\u{1f4a1}"],
    emoji: "💡",
    label: "Insight",
    tone: "accent",
  },
  {
    symbols: ["\u{1f3af}"],
    emoji: "🎯",
    label: "Target",
    tone: "accent",
  },
  {
    symbols: ["\u{1f4ca}"],
    emoji: "📊",
    label: "Data visualization",
    tone: "info",
  },
  {
    symbols: ["\u23f1", "\u23f0", "\u{1f552}"],
    emoji: "⏱️",
    label: "Time",
    tone: "neutral",
  },
  {
    symbols: ["\u{1f50d}", "\u{1f50e}"],
    emoji: "🔍",
    label: "Investigation",
    tone: "info",
  },
  {
    symbols: ["\u{1f5c4}", "\u{1f5c3}"],
    emoji: "🗄️",
    label: "Data",
    tone: "info",
  },
  {
    symbols: ["\u2728", "\u2b50", "\u{1f31f}", "\u{1f4ab}"],
    emoji: "✨",
    label: "Highlight",
    tone: "accent",
  },
];

const markerDetails = new Map<string, MarkerDetails>(
  markerGroups.flatMap(({ symbols, ...details }) =>
    symbols.map((symbol) => [symbol, details] as const),
  ),
);

const emojiSequenceSource =
  "(?:\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3|\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\p{Emoji_Modifier})?(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\p{Emoji_Modifier})?)*)";
const emojiSplitPattern = new RegExp(`(${emojiSequenceSource})`, "gu");
const emojiOnlyPattern = new RegExp(`^${emojiSequenceSource}$`, "u");
const emojiPresentationPattern = /[\ufe0e\ufe0f]|\p{Emoji_Modifier}/gu;

export function renderInlineVisualMarkers(text: string, keyPrefix = "visual") {
  const parts = text.split(emojiSplitPattern);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (!emojiOnlyPattern.test(part)) return part;

    const normalized = part.replace(emojiPresentationPattern, "");
    const details = markerDetails.get(normalized);
    if (!details) {
      return (
        <span
          key={`${keyPrefix}-${index}`}
          className="inline-visual-marker generic"
          role="img"
          aria-label="Visual indicator"
          title="Visual indicator"
        >
          <span aria-hidden="true">{part}</span>
        </span>
      );
    }

    return (
      <span
        key={`${keyPrefix}-${index}`}
        className={`inline-visual-marker ${details.tone}`}
        role="img"
        aria-label={details.label}
        title={details.label}
      >
        <span aria-hidden="true">{details.emoji}</span>
      </span>
    );
  });
}
