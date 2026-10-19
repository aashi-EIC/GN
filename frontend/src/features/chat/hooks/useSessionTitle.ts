import { useEffect } from "react";
import type { Conversation } from "../../../shared/types/app";
import { localConversationTitle } from "../../../shared/utils/session";
import { fetchSessionTitle } from "../services/sessionTitle";

type UpdateConversations = (update: (current: Conversation[]) => Conversation[]) => void;

export function useSessionTitle(
  conversation: Conversation | undefined,
  isGenerating: boolean,
  updateConversations: UpdateConversations,
) {
  const conversationId = conversation?.id;
  const sessionId = conversation?.mcpSessionId;
  const revision = conversation?.updatedAt;

  const isManual = conversation
    ? localConversationTitle(conversation, conversation.messages).titleSource === "manual"
    : false;

  useEffect(() => {
    if (!conversationId || !sessionId || isGenerating || isManual) {
      return;
    }

    const controller = new AbortController();

    async function refreshTitle() {
      try {
        const title = await fetchSessionTitle(sessionId!, controller.signal);

        if (!title || controller.signal.aborted) return;

        updateConversations((current) =>
          current.map((item) => {
            const manuallyNamed =
              localConversationTitle(item, item.messages).titleSource === "manual";

            if (
              controller.signal.aborted ||
              item.id !== conversationId ||
              item.mcpSessionId !== sessionId ||
              item.updatedAt !== revision ||
              manuallyNamed ||
              (item.title === title && item.titleSource === "server")
            ) {
              return item;
            }

            return {
              ...item,
              title,
              titleSource: "server",
            };
          }),
        );
      } catch {
        // Optional metadata must not interrupt chat or replace its fallback title.
      }
    }

    void refreshTitle();

    return () => controller.abort();
  }, [conversationId, sessionId, revision, isGenerating, isManual, updateConversations]);
}
