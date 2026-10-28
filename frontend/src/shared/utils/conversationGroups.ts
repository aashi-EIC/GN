import type { Conversation } from "../types/app";
import { getModel } from "../../features/chat/utils/semantic";

const BUCKET_ORDER = ["Today", "Yesterday", "This Week", "Last Week", "Past Months"];

type DateGroup = { label: string; conversations: Conversation[] };
type ModelGroup = DateGroup & { short: string; color: string };

function dateBucket(updatedAt: string, startOfToday: number) {
  const updated = new Date(updatedAt);
  const startOfUpdated = new Date(updated.getFullYear(), updated.getMonth(), updated.getDate());
  const dayDiff = Math.floor((startOfToday - startOfUpdated.getTime()) / 86_400_000);

  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff <= 7) return "This Week";
  if (dayDiff <= 14) return "Last Week";
  return "Past Months";
}

export function groupHistoryByDate(
  conversations: Conversation[],
  startOfToday: number,
): DateGroup[] {
  const groups = new Map<string, Conversation[]>();
  for (const conversation of conversations) {
    const label = dateBucket(conversation.updatedAt, startOfToday);
    const group = groups.get(label);
    if (group) group.push(conversation);
    else groups.set(label, [conversation]);
  }
  return BUCKET_ORDER.flatMap((label) => {
    const conversations = groups.get(label);
    return conversations ? [{ label, conversations }] : [];
  });
}

export function groupHistoryByModel(conversations: Conversation[]): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  for (const conversation of conversations) {
    const model = getModel(conversation.modelId);
    const label = conversation.modelSelectionRequired
      ? "Saved chats"
      : model.nickname || model.short;
    const group = groups.get(label);
    if (group) {
      group.short = model.short;
      group.color = model.color;
      group.conversations.push(conversation);
    } else
      groups.set(label, {
        label,
        short: model.short,
        color: model.color,
        conversations: [conversation],
      });
  }
  return [...groups.values()];
}
