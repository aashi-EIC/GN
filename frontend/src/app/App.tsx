import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppRouter } from "./router";
import { uiActions, useAppDispatch, useAppSelector } from "./store";
import { Composer } from "../features/chat/components/Composer";
import { MessageBubble } from "../features/chat/components/MessageBubble";
import { WelcomePanel } from "../features/chat/components/WelcomePanel";
import { ErrorReportModal } from "../features/debug/components/ErrorReportModal";
import { GuideModal } from "../features/settings/components/GuideModal";
import { SettingsModal } from "../features/settings/components/SettingsModal";
import { TourModal } from "../shared/components/TourModal";
import { Navbar } from "../shared/components/Navbar";
import { Sidebar } from "../shared/components/Sidebar";
import { storageKeys } from "../shared/config/storage";
import { loadFromStorage, saveToStorageDeferred } from "../shared/utils/storage";
import {
  buildMcpRequestPayload,
  formatUserFriendlyError,
  persistMcpRequestAudit,
  requestMcpInsight,
} from "../features/chat/services/mcp.service";
import type { McpSessionMetadata } from "../features/chat/services/mcp.service";
import {
  readBrowserSettings,
  persistBrowserSettings,
} from "../features/settings/services/browserSettings";
import type {
  Conversation,
  FeedbackValue,
  IssueReport,
  McpRequestAudit,
  Message,
  SettingsState,
  ToastState,
  UserProfile,
} from "../shared/types/app";
import type { CountryCode, ModelId } from "../features/chat/types/semantic";
import { copyText, messageToPlainText } from "../shared/utils/clipboard";
import {
  createId,
  createSessionId,
  isSessionId,
  titleFromUserMessages,
} from "../shared/utils/session";
import { getModel, normalizeCountryCode, normalizeModelId } from "../features/chat/utils/semantic";
import { calculateTokenUsageAndCost } from "../features/chat/utils/tokenCost";
import { normalizeStoredConversation } from "../features/chat/utils/responseDisplay";

const WORKSPACE_USER: UserProfile = {
  name: "Workspace User",
  email: "workspace@local",
  authProvider: "No Authentication",
};

function applyMcpSessionMetadata(
  conversation: Conversation,
  metadata: McpSessionMetadata | undefined,
): Conversation {
  if (!metadata) return conversation;
  const next = { ...conversation };
  if (metadata.requiresNewSession) delete next.mcpSessionId;
  else if (metadata.id) next.mcpSessionId = metadata.id;
  if (metadata.messageCount !== undefined) next.mcpMessageCount = metadata.messageCount;
  if (metadata.status) next.mcpSessionStatus = metadata.status;
  return next;
}

function AppRoot() {
  return <AppRouter shell={<IntelligenceApp />} />;
}

function IntelligenceApp() {
  const [settings, setSettings] = useState<SettingsState>(readBrowserSettings);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);

  const handleUpdateSettings = (nextSettings: SettingsState) => {
    setSettings(nextSettings);

    setSettingsSaveError(persistBrowserSettings(nextSettings));
  };

  const effectiveUser = {
    ...WORKSPACE_USER,
    name: settings.displayName.trim() || WORKSPACE_USER.name,
  };

  return (
    <Workspace
      user={effectiveUser}
      settings={settings}
      setSettings={handleUpdateSettings}
      settingsSaveError={settingsSaveError}
    />
  );
}

function Workspace({
  user,
  settings,
  setSettings,
  settingsSaveError,
}: {
  user: UserProfile;
  settings: SettingsState;
  setSettings: (settings: SettingsState) => void;
  settingsSaveError: string | null;
}) {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const debugOpen = useAppSelector((state) => state.ui.debugOpen);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadFromStorage<Conversation[]>(storageKeys.conversations, []).map((conversation) =>
      normalizeStoredConversation(
        {
          ...conversation,
          id: isSessionId(conversation.id) ? conversation.id : createSessionId(),
        },
        settings.tablePageSize,
      ),
    ),
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<ModelId>(() =>
    normalizeModelId(undefined),
  );
  const [selectedCountryCode, setSelectedCountryCode] = useState<CountryCode>(() =>
    normalizeCountryCode(undefined),
  );
  const [prompt, setPrompt] = useState("");
  const [thinkingConversationIds, setThinkingConversationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [modelsOpen, setModelsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveToStorageDeferred(storageKeys.conversations, conversations);
  }, [conversations]);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const activeConversationIsThinking = activeConversationId
    ? thinkingConversationIds.has(activeConversationId)
    : false;
  const lastMessage = activeConversation?.messages.at(-1);
  const selectedModel = getModel(selectedModelId);
  const sortedConversations = useMemo(
    () =>
      [...conversations].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [conversations],
  );
  const filteredConversations = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) {
      return sortedConversations;
    }
    return sortedConversations.filter((conversation) => {
      const titleMatches = conversation.title.toLowerCase().includes(query);
      const model = getModel(conversation.modelId);
      const modelNameMatches = model.name.toLowerCase().includes(query);
      const modelShortMatches = model.short.toLowerCase().includes(query);
      const messageMatches = conversation.messages.some((message) =>
        message.text.toLowerCase().includes(query),
      );
      return titleMatches || modelNameMatches || modelShortMatches || messageMatches;
    });
  }, [sortedConversations, historyQuery]);

  useEffect(() => {
    dispatch(uiActions.setDebugOpen(settings.keepDebugOpen));
  }, [dispatch, settings.keepDebugOpen]);

  useEffect(() => {
    document.title = "Conversational BI | Gracenote";
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [activeConversationId, activeConversation?.messages.length, activeConversationIsThinking]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    const closeOpenNavigation = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (modelsOpen && !target.closest(".model-picker")) {
        setModelsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setModelsOpen(false);
      if (sidebarOpen) {
        dispatch(uiActions.setSidebarOpen(false));
      }
    };

    document.addEventListener("pointerdown", closeOpenNavigation);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOpenNavigation);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [dispatch, modelsOpen, sidebarOpen]);

  const showToast = (message: string, tone: ToastState["tone"] = "success") => {
    setToast({ message, tone });
  };

  const closeTour = () => {
    setTourOpen(false);
    try {
      localStorage.setItem(storageKeys.tourSeen, "true");
    } catch {
      showToast("Could not save guide preferences in this browser", "warning");
    }
  };

  const startConversation = () => {
    setActiveConversationId(null);
    setPrompt("");
    setModelsOpen(false);
  };

  const setActiveConversationModel = (nextModelId: ModelId) => {
    if (activeConversation?.messages.length) {
      setModelsOpen(false);
      showToast("Start a new chat to change the semantic model", "warning");
      return;
    }

    setSelectedModelId(nextModelId);
    if (!activeConversation) {
      return;
    }

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversation.id
          ? { ...conversation, modelId: nextModelId }
          : conversation,
      ),
    );
  };

  const openConversation = (conversation: Conversation) => {
    setActiveConversationId(conversation.id);
    setSelectedModelId(normalizeModelId(conversation.modelId));
    setSelectedCountryCode(normalizeCountryCode(conversation.countryCode));
    setModelsOpen(false);
  };

  const deleteConversation = (conversationId: string) => {
    setConversations((current) => {
      const nextConversations = current.filter(
        (conversation) => conversation.id !== conversationId,
      );
      if (activeConversationId === conversationId) {
        const nextActive = nextConversations[0] ?? null;
        setActiveConversationId(nextActive?.id ?? null);
        if (nextActive) {
          setSelectedModelId(normalizeModelId(nextActive.modelId));
          setSelectedCountryCode(normalizeCountryCode(nextActive.countryCode));
        }
      }
      return nextConversations;
    });
    showToast("Conversation removed");
  };

  const submitPrompt = async (question = prompt) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return;
    }

    const conversationId = activeConversation?.id ?? createSessionId();
    if (thinkingConversationIds.has(conversationId)) return;

    const currentModelId = normalizeModelId(activeConversation?.modelId ?? selectedModelId);
    const currentCountryCode = normalizeCountryCode(
      activeConversation?.countryCode ?? selectedCountryCode,
    );
    const responseTablePageSize = settings.tablePageSize;
    const createdAt = new Date().toISOString();
    const userMessage: Message = {
      id: createId("msg"),
      role: "user",
      text: trimmedQuestion,
      createdAt,
    };

    setPrompt("");
    setModelsOpen(false);
    setThinkingConversationIds((current) => new Set(current).add(conversationId));

    setConversations((current) => {
      const existing = current.find((conversation) => conversation.id === conversationId);
      if (existing) {
        return current.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          const nextMessages = [...conversation.messages, userMessage];
          const userMsgs = nextMessages.filter((m) => m.role === "user").map((m) => m.text);
          return {
            ...conversation,
            title: titleFromUserMessages(userMsgs),
            messages: nextMessages,
            updatedAt: createdAt,
          };
        });
      }

      const nextConversation: Conversation = {
        id: conversationId,
        title: titleFromUserMessages([trimmedQuestion]),
        modelId: currentModelId,
        countryCode: currentCountryCode,
        messages: [userMessage],
        createdAt,
        updatedAt: createdAt,
      };
      return [nextConversation, ...current];
    });
    setActiveConversationId(conversationId);
    setSelectedModelId(currentModelId);

    let requestAudit: McpRequestAudit | null = null;

    try {
      const mcpRequest = buildMcpRequestPayload({
        conversationId,
        mcpSessionId: activeConversation?.mcpSessionId,
        modelId: currentModelId,
        prompt: trimmedQuestion,
      });
      requestAudit = mcpRequest.audit;
      persistMcpRequestAudit(requestAudit);
      const insight = await requestMcpInsight(mcpRequest.payload, requestAudit);
      const answer = insight.answer;
      if (insight.mcpSession?.requiresNewSession) {
        showToast("MCP session ended. Your next prompt will start a new session.", "warning");
      }
      const tokenUsage = calculateTokenUsageAndCost(
        currentModelId,
        trimmedQuestion,
        answer.text || "",
      );
      const responseMessage: Message = {
        id: createId("msg"),
        role: "assistant",
        createdAt: new Date().toISOString(),
        tablePageSize: responseTablePageSize,
        mcpRequest: requestAudit,
        tokenUsage,
        ...answer,
      };

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...applyMcpSessionMetadata(conversation, insight.mcpSession),
                messages: [...conversation.messages, responseMessage],
                updatedAt: responseMessage.createdAt,
              }
            : conversation,
        ),
      );
    } catch (error) {
      const rawMessage =
        error instanceof Error
          ? error.message
          : "The analytics engine could not complete this request.";
      const errorInfo = formatUserFriendlyError(rawMessage);
      const displayText = `${errorInfo.userMessage}\n\n💡 **Suggested Action**: ${errorInfo.suggestion}`;
      const tokenUsage = calculateTokenUsageAndCost(currentModelId, trimmedQuestion, displayText);
      const responseMessage: Message = {
        id: createId("msg"),
        role: "assistant",
        createdAt: new Date().toISOString(),
        tablePageSize: responseTablePageSize,
        text: displayText,
        metrics: [
          {
            label: "Status",
            value: errorInfo.statusLabel,
            tone: "watch",
          },
        ],
        debug: [
          ...(requestAudit
            ? [
                {
                  stage: "mcp_request_payload",
                  status: "success" as const,
                  detail: "Payload prepared for Node BFF",
                  payload: requestAudit,
                },
              ]
            : []),
          {
            stage: "request_error",
            status: "warning",
            detail: rawMessage,
          },
        ],
        mcpRequest: requestAudit ?? undefined,
        tokenUsage,
      };

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: [...conversation.messages, responseMessage],
                updatedAt: responseMessage.createdAt,
              }
            : conversation,
        ),
      );
    } finally {
      setThinkingConversationIds((current) => {
        const next = new Set(current);
        next.delete(conversationId);
        return next;
      });
    }
  };

  const handleEditUserMessage = async (messageId: string, newText: string) => {
    const trimmedQuestion = newText.trim();
    if (!trimmedQuestion || !activeConversation) {
      return;
    }

    const currentModelId = normalizeModelId(activeConversation.modelId ?? selectedModelId);
    const responseTablePageSize = settings.tablePageSize;
    const createdAt = new Date().toISOString();
    const conversationId = activeConversation.id;
    if (thinkingConversationIds.has(conversationId)) return;

    const msgIndex = activeConversation.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const previousMessages = activeConversation.messages.slice(0, msgIndex);
    const updatedUserMessage: Message = {
      ...activeConversation.messages[msgIndex],
      text: trimmedQuestion,
      createdAt,
    };
    const nextMessages = [...previousMessages, updatedUserMessage];

    setThinkingConversationIds((current) => new Set(current).add(conversationId));

    setConversations((current) =>
      current.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const userMsgs = nextMessages.filter((m) => m.role === "user").map((m) => m.text);
        return {
          ...conversation,
          title: titleFromUserMessages(userMsgs),
          messages: nextMessages,
          updatedAt: createdAt,
        };
      }),
    );

    let requestAudit: McpRequestAudit | null = null;

    try {
      const mcpRequest = buildMcpRequestPayload({
        conversationId,
        mcpSessionId: activeConversation.mcpSessionId,
        modelId: currentModelId,
        prompt: trimmedQuestion,
      });
      requestAudit = mcpRequest.audit;
      persistMcpRequestAudit(requestAudit);
      const insight = await requestMcpInsight(mcpRequest.payload, requestAudit);
      const answer = insight.answer;
      if (insight.mcpSession?.requiresNewSession) {
        showToast("MCP session ended. Your next prompt will start a new session.", "warning");
      }
      const tokenUsage = calculateTokenUsageAndCost(
        currentModelId,
        trimmedQuestion,
        answer.text || "",
      );
      const responseMessage: Message = {
        id: createId("msg"),
        role: "assistant",
        createdAt: new Date().toISOString(),
        tablePageSize: responseTablePageSize,
        mcpRequest: requestAudit,
        tokenUsage,
        ...answer,
      };

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...applyMcpSessionMetadata(conversation, insight.mcpSession),
                messages: [...nextMessages, responseMessage],
                updatedAt: responseMessage.createdAt,
              }
            : conversation,
        ),
      );
    } catch (error) {
      const rawMessage =
        error instanceof Error
          ? error.message
          : "The analytics engine could not complete this request.";
      const errorInfo = formatUserFriendlyError(rawMessage);
      const displayText = `${errorInfo.userMessage}\n\n💡 **Suggested Action**: ${errorInfo.suggestion}`;
      const tokenUsage = calculateTokenUsageAndCost(currentModelId, trimmedQuestion, displayText);
      const responseMessage: Message = {
        id: createId("msg"),
        role: "assistant",
        createdAt: new Date().toISOString(),
        tablePageSize: responseTablePageSize,
        text: displayText,
        metrics: [
          {
            label: "Status",
            value: errorInfo.statusLabel,
            tone: "watch",
          },
        ],
        debug: [
          ...(requestAudit
            ? [
                {
                  stage: "mcp_request_payload",
                  status: "success" as const,
                  detail: "Payload prepared for Node BFF",
                  payload: requestAudit,
                },
              ]
            : []),
          {
            stage: "request_error",
            status: "warning",
            detail: rawMessage,
          },
        ],
        mcpRequest: requestAudit ?? undefined,
        tokenUsage,
      };

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: [...nextMessages, responseMessage],
                updatedAt: responseMessage.createdAt,
              }
            : conversation,
        ),
      );
      showToast("Unable to analyze request", "warning");
    } finally {
      setThinkingConversationIds((current) => {
        const next = new Set(current);
        next.delete(conversationId);
        return next;
      });
    }
  };

  const regenerateResponse = (messageId: string) => {
    if (!activeConversation || thinkingConversationIds.has(activeConversation.id)) return;

    const responseIndex = activeConversation.messages.findIndex(
      (message) => message.id === messageId && message.role === "assistant",
    );
    if (responseIndex < 0) return;

    const precedingUserMessage = [...activeConversation.messages]
      .slice(0, responseIndex)
      .reverse()
      .find((message) => message.role === "user");

    if (!precedingUserMessage) {
      showToast("No prompt found for this response", "warning");
      return;
    }

    setFeedback((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
    showToast("Regenerating response");
    void handleEditUserMessage(precedingUserMessage.id, precedingUserMessage.text);
  };

  const saveSettings = (nextSettings: SettingsState) => {
    setSettings(nextSettings);
    dispatch(uiActions.setDebugOpen(nextSettings.keepDebugOpen));
  };

  const submitIssue = async (issue: IssueReport) => {
    setIssueOpen(false);
    showToast(`Issue ${issue.id} saved`);
  };

  const copyMessage = async (message: Message) => {
    await copyText(messageToPlainText(message));
    showToast(message.role === "user" ? "Message copied" : "Response copied");
  };

  const markFeedback = async (messageId: string, value: FeedbackValue) => {
    const removing = feedback[messageId] === value;

    setFeedback((current) => {
      const next = { ...current };
      if (next[messageId] === value) {
        delete next[messageId];
      } else {
        next[messageId] = value;
      }
      return next;
    });
    showToast(
      removing
        ? "Feedback removed"
        : value === "helpful"
          ? "Marked as a good response"
          : "Marked as a bad response",
    );
  };

  const openSelectedModelGuide = () => {
    setModelsOpen(false);
    setGuideOpen(true);
  };

  const handleRenameConversation = (conversationId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, title: trimmed } : conversation,
      ),
    );
    showToast("Chat title updated");
  };

  const handleTogglePinConversation = (conversationId: string) => {
    setConversations((current) =>
      current.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const nextPinned = !conversation.pinned;
        showToast(nextPinned ? "Chat pinned" : "Chat unpinned");
        return { ...conversation, pinned: nextPinned };
      }),
    );
  };

  return (
    <div className={`app-shell density-${settings.density}`}>
      <Sidebar
        open={sidebarOpen}
        user={user}
        conversations={filteredConversations}
        activeConversationId={activeConversationId}
        historyQuery={historyQuery}
        setHistoryQuery={setHistoryQuery}
        startConversation={startConversation}
        openConversation={openConversation}
        deleteConversation={deleteConversation}
        onRenameConversation={handleRenameConversation}
        onTogglePinConversation={handleTogglePinConversation}
        setSidebarOpen={(open) => dispatch(uiActions.setSidebarOpen(open))}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
      />

      <section className="workspace">
        <Navbar
          modelId={selectedModelId}
          openGuide={openSelectedModelGuide}
          conversationTitle={activeConversation?.title}
          sidebarOpen={sidebarOpen}
          onSelectPrompt={submitPrompt}
        />

        <main className={activeConversation ? "chat" : "welcome"}>
          {!activeConversation ? (
            <WelcomePanel
              user={user}
              model={selectedModel}
              modelId={selectedModelId}
              setModelId={setSelectedModelId}
              modelsOpen={modelsOpen}
              setModelsOpen={setModelsOpen}
              prompt={prompt}
              setPrompt={setPrompt}
              submitPrompt={submitPrompt}
            />
          ) : (
            <>
              <div className="messages">
                {activeConversation.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    tablePageSize={message.tablePageSize ?? settings.tablePageSize}
                    debugOpen={debugOpen}
                    feedback={feedback[message.id]}
                    copyMessage={copyMessage}
                    markFeedback={markFeedback}
                    onReportError={() => setIssueOpen(true)}
                    onEditUserMessage={handleEditUserMessage}
                    onRegenerateResponse={regenerateResponse}
                    busy={activeConversationIsThinking}
                  />
                ))}
                {activeConversationIsThinking && (
                  <div className="assistant-row" key={`loading-${activeConversationId}`}>
                    <div className="ai-mark" aria-hidden="true">
                      <Sparkles />
                    </div>
                    <div className="thinking" role="status" aria-live="polite">
                      <span className="thinking-wave" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="thinking-label">Analyzing your data</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <Composer
                prompt={prompt}
                setPrompt={setPrompt}
                submitPrompt={submitPrompt}
                busy={activeConversationIsThinking}
                modelId={normalizeModelId(activeConversation.modelId)}
                setModelId={setActiveConversationModel}
                modelsOpen={modelsOpen}
                setModelsOpen={setModelsOpen}
                modelLocked={activeConversation.messages.length > 0}
                countryCode={normalizeCountryCode(
                  activeConversation.countryCode ?? selectedCountryCode,
                )}
              />
            </>
          )}
        </main>
      </section>

      {tourOpen && <TourModal close={closeTour} modelId={selectedModelId} />}
      {guideOpen && (
        <GuideModal
          close={() => setGuideOpen(false)}
          modelId={normalizeModelId(activeConversation?.modelId ?? selectedModelId)}
          onSelectPrompt={submitPrompt}
        />
      )}
      {issueOpen && (
        <ErrorReportModal
          close={() => setIssueOpen(false)}
          submitIssue={submitIssue}
          activeConversationId={
            activeConversationId || (conversations.length > 0 ? conversations[0].id : null)
          }
          modelId={normalizeModelId(activeConversation?.modelId ?? selectedModelId)}
          modelName={
            getModel(normalizeModelId(activeConversation?.modelId ?? selectedModelId)).name
          }
          lastMessage={lastMessage}
          lastMessageFeedback={lastMessage ? feedback[lastMessage.id] : undefined}
          copyMessage={copyMessage}
          markFeedback={markFeedback}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          close={() => setSettingsOpen(false)}
          settings={settings}
          settingsSaveError={settingsSaveError}
          saveSettings={saveSettings}
          toggleDebug={() => saveSettings({ ...settings, keepDebugOpen: !debugOpen })}
        />
      )}
      {toast && <div className={`toast ${toast.tone}`}>{toast.message}</div>}
    </div>
  );
}

export { AppRoot };
