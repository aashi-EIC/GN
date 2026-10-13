import { useEffect, useState, useSyncExternalStore } from "react";
import { createConversationHistory } from "../services/conversationHistory";

export function useConversationHistory(tablePageSize: number) {
  const [history] = useState(() => createConversationHistory(tablePageSize));
  const conversations = useSyncExternalStore(history.subscribe, history.getSnapshot);
  useEffect(() => history.connect(), [history]);
  return [conversations, history.update] as const;
}
