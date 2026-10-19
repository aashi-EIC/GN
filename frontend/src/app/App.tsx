import { AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMatch } from "react-router-dom";
import { AppRouter } from "./router";
import { uiActions, useAppDispatch, useAppSelector } from "./store";
import { Composer } from "../features/chat/components/Composer";
import { MessageBubble, PendingResponse } from "../features/chat/components/MessageBubble";
import { WelcomePanel } from "../features/chat/components/WelcomePanel";
import { ErrorReportModal } from "../features/debug/components/ErrorReportModal";
import { GuideModal } from "../features/settings/components/GuideModal";
import { SettingsModal } from "../features/settings/components/SettingsModal";
import { TourModal } from "../shared/components/TourModal";
import { Navbar } from "../shared/components/Navbar";
import { Sidebar } from "../shared/components/Sidebar";
import { ToastNotification } from "../shared/components/ToastNotification";
import { AssistantMark } from "../shared/components/AssistantMark";
import { storageKeys } from "../shared/config/storage";
import { useConversationHistory } from "../features/chat/hooks/useConversationHistory";
import { createStreamProgress } from "../features/chat/services/streamProgress";
import { savedHistoryDisplayItems } from "../features/chat/utils/responseDisplay";
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
  ChatTransportMode,
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
  titleFromUserMessages,
  localConversationTitle,
} from "../shared/utils/session";
import { getModel, normalizeCountryCode, normalizeModelId } from "../features/chat/utils/semantic";
import { calculateTokenUsageAndCost } from "../features/chat/utils/tokenCost";
import {
  recordRegenerationAttempt,
  replaceAssistantResponse,
} from "../features/chat/utils/regeneration";
import { useSessionTitle } from "../features/chat/hooks/useSessionTitle";

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
  const streamRoute = useMatch("/chat/stream");
  const chatRoute = useMatch("/chat/*");
  const mode: ChatTransportMode = streamRoute ? "streaming" : chatRoute ? "standard" : "auto";
  return <AppRouter shell={<IntelligenceApp mode={mode} />} />;
}

function IntelligenceApp({ mode }: { mode: ChatTransportMode }) {
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
      mode={mode}
      user={effectiveUser}
      settings={settings}
      setSettings={handleUpdateSettings}
      settingsSaveError={settingsSaveError}
    />
  );
}

function Workspace({
  mode,
  user,
  settings,
  setSettings,
  settingsSaveError,
}: {
  mode: ChatTransportMode;
  user: UserProfile;
  settings: SettingsState;
  setSettings: (settings: SettingsState) => void;
  settingsSaveError: string | null;
}) {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const debugOpen = useAppSelector((state) => state.ui.debugOpen);
  const themeMode = useAppSelector((state) => state.ui.themeMode);
  const [conversations, setConversations] = useConversationHistory(settings.tablePageSize);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<ModelId>(() =>
    normalizeModelId(undefined),
  );
  const [selectedCountryCode, setSelectedCountryCode] = useState<CountryCode>(() =>
    normalizeCountryCode(undefined),
  );
  const [prompt, setPrompt] = useState("");
  const [magicHintDismissed, setMagicHintDismissed] = useState(false);
  const [thinkingConversationIds, setThinkingConversationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [regeneratingResponseIds, setRegeneratingResponseIds] = useState<Record<string, string>>(
    {},
  );
  const [modelsOpen, setModelsOpen] = useState(false);
  const [streamProgress] = useState(createStreamProgress);
  useEffect(() => () => streamProgress.dispose(), [streamProgress]);
  const streamingCallbacks = (conversationId: string) => ({
    onTextDelta: (delta: string) => streamProgress.append(conversationId, delta),
    onStatus: (message: string) => streamProgress.setStatus(conversationId, message),
    // Retain the authoritative MCP session even if this stream later disconnects.
    onSession: (id: string) =>
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? applyMcpSessionMetadata(conversation, { id, requiresNewSession: false })
            : conversation,
        ),
      ),
  });
  const clearGenerationStatus = (conversationId: string) => streamProgress.clear(conversationId);
  const [guideOpen, setGuideOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [walkthroughDismissed, setWalkthroughDismissed] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const followStreamRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const generationWasActiveRef = useRef<{ conversationId: string | null; active: boolean }>({
    conversationId: null,
    active: false,
  });
  const regenerationScrollRef = useRef<{
    conversationId: string | null;
    anchor: HTMLElement | null;
    offset: number;
  } | null>(null);

  useEffect(() => {
    if (activeConversationId && !conversations.some(({ id }) => id === activeConversationId)) {
      setActiveConversationId(null);
      dispatch(uiActions.setDebugOpen(false));
    }
  }, [activeConversationId, conversations, dispatch]);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const activeConversationIsThinking = activeConversationId
    ? thinkingConversationIds.has(activeConversationId)
    : false;
  useSessionTitle(activeConversation, activeConversationIsThinking, setConversations);
  const activeRegeneratingResponseId = activeConversationId
    ? regeneratingResponseIds[activeConversationId]
    : undefined;
  const lastUserMessage = activeConversation?.messages
    .filter((message) => message.role === "user")
    .at(-1);
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
    document.documentElement.dataset.theme = themeMode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeMode === "dark" ? "#050b14" : "#ffffff");
    try {
      localStorage.setItem(storageKeys.theme, themeMode);
    } catch {
      // Theme still works for this session when browser storage is unavailable.
    }
  }, [themeMode]);

  useEffect(() => {
    document.title = "Conversational BI | Gracenote";
  }, []);

  useLayoutEffect(() => {
    const container = messagesRef.current;
    const finishingGeneration =
      generationWasActiveRef.current.conversationId === activeConversationId &&
      generationWasActiveRef.current.active &&
      !activeConversationIsThinking;
    generationWasActiveRef.current = {
      conversationId: activeConversationId,
      active: activeConversationIsThinking,
    };
    const previousRegeneration = regenerationScrollRef.current;
    if (activeRegeneratingResponseId && container) {
      const rememberPosition = () => {
        const bounds = container.getBoundingClientRect();
        let anchor =
          Array.from(container.children).find(
            (element): element is HTMLElement =>
              element instanceof HTMLElement &&
              element.matches(".assistant-row, .user-row") &&
              element.getBoundingClientRect().bottom > bounds.top &&
              element.getBoundingClientRect().top < bounds.bottom,
          ) ?? null;
        const actions = anchor?.querySelector<HTMLElement>(".response-actions");
        if (
          anchor &&
          anchor.getBoundingClientRect().top < bounds.top &&
          actions &&
          actions.getBoundingClientRect().top >= bounds.top &&
          actions.getBoundingClientRect().bottom <= bounds.bottom
        ) {
          anchor = actions;
        }
        regenerationScrollRef.current = {
          conversationId: activeConversationId,
          anchor,
          offset: anchor ? anchor.getBoundingClientRect().top - bounds.top : 0,
        };
      };
      rememberPosition();
      container.addEventListener("scroll", rememberPosition, { passive: true });
      return () => container.removeEventListener("scroll", rememberPosition);
    }

    regenerationScrollRef.current = null;
    if (previousRegeneration?.conversationId === activeConversationId) {
      const anchor = previousRegeneration.anchor;
      if (container && anchor?.isConnected && container.contains(anchor)) {
        const bounds = container.getBoundingClientRect();
        const scale = bounds.height / container.offsetHeight || 1;
        container.scrollTop +=
          (anchor.getBoundingClientRect().top - bounds.top - previousRegeneration.offset) / scale;
      }
      return;
    }

    if (finishingGeneration && !followStreamRef.current) {
      if (container) {
        setShowJumpToLatest(
          container.scrollHeight - container.scrollTop - container.clientHeight > 80,
        );
      }
      return;
    }
    bottomRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [
    activeConversationId,
    activeConversation?.messages.length,
    activeRegeneratingResponseId,
    activeConversationIsThinking,
  ]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    followStreamRef.current = true;
    setShowJumpToLatest(false);
    let previousTop = container.scrollTop;
    const trackPosition = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      // An intentional upward scroll pauses following, even close to the bottom.
      if (container.scrollTop < previousTop - 1) followStreamRef.current = false;
      else if (distance < 8) followStreamRef.current = true;
      previousTop = container.scrollTop;
      setShowJumpToLatest(!followStreamRef.current && distance > 80);
    };
    const pauseOnWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) followStreamRef.current = false;
    };
    const pauseOnTouch = () => {
      // Let native touch scrolling take control before the next animation frame.
      followStreamRef.current = false;
    };
    container.addEventListener("scroll", trackPosition, { passive: true });
    container.addEventListener("wheel", pauseOnWheel, { passive: true });
    container.addEventListener("touchstart", pauseOnTouch, { passive: true });
    return () => {
      container.removeEventListener("scroll", trackPosition);
      container.removeEventListener("wheel", pauseOnWheel);
      container.removeEventListener("touchstart", pauseOnTouch);
    };
  }, [activeConversationId]);

  useLayoutEffect(() => {
    const container = messagesRef.current;
    const preview = container?.querySelector(".streaming-response");
    if (!container || !preview || activeRegeneratingResponseId) return;
    let frame = 0;
    let previousTime = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const follow = (time: number) => {
      frame = 0;
      if (!followStreamRef.current) return;
      const distance = container.scrollHeight - container.clientHeight - container.scrollTop;
      if (distance < 1) return;
      const elapsed = previousTime ? Math.min(64, time - previousTime) : 16;
      previousTime = time;
      container.scrollTop += reducedMotion.matches
        ? distance
        : Math.max(1, distance * (1 - Math.exp(-elapsed / 65)));
      if (!reducedMotion.matches) frame = requestAnimationFrame(follow);
    };
    // Subscribe to the active answer without re-rendering the workspace for each token.
    const observer = new ResizeObserver(() => {
      if (!followStreamRef.current) {
        setShowJumpToLatest(
          container.scrollHeight - container.scrollTop - container.clientHeight > 80,
        );
        return;
      }
      if (followStreamRef.current && !frame) {
        previousTime = 0;
        frame = requestAnimationFrame(follow);
      }
    });
    observer.observe(preview);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [activeConversationId, activeConversationIsThinking, activeRegeneratingResponseId]);

  const jumpToLatest = () => {
    followStreamRef.current = true;
    setShowJumpToLatest(false);
    const container = messagesRef.current;
    container?.scrollTo({
      top: container.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

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
      if (
        sidebarOpen &&
        window.matchMedia("(max-width: 900px)").matches &&
        !target.closest(".sidebar, .mobile-menu")
      ) {
        dispatch(uiActions.setSidebarOpen(false));
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
    setWalkthroughDismissed(true);
    try {
      localStorage.setItem(storageKeys.tourSeen, "true");
    } catch {
      showToast("Could not save guide preferences in this browser", "warning");
    }
  };

  const startConversation = () => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      dispatch(uiActions.setSidebarOpen(false));
    }
    setActiveConversationId(null);
    setPrompt("");
    setMagicHintDismissed(false);
    setModelsOpen(false);
  };

  const setActiveConversationModel = (nextModelId: ModelId) => {
    if (activeConversation?.messages.length && !activeConversation.modelSelectionRequired) {
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
          ? { ...conversation, modelId: nextModelId, modelSelectionRequired: false }
          : conversation,
      ),
    );
  };

  const openConversation = (conversation: Conversation) => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      dispatch(uiActions.setSidebarOpen(false));
    }
    setWalkthroughDismissed(true);
    setActiveConversationId(conversation.id);
    setMagicHintDismissed(true);
    setSelectedModelId(normalizeModelId(conversation.modelId));
    setSelectedCountryCode(normalizeCountryCode(conversation.countryCode));
    setModelsOpen(false);
  };

  const deleteConversation = (conversationId: string) => {
    conversations
      .find(({ id }) => id === conversationId)
      ?.messages.forEach(({ id }) => streamProgress.clear(id));
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
  };

  const submitPrompt = async (question = prompt) => {
    if (activeConversationIsThinking) return;
    if (activeConversation?.modelSelectionRequired) {
      setModelsOpen(true);
      showToast("Select the semantic model for this saved chat before continuing", "warning");
      return;
    }
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return;
    }
    setMagicHintDismissed(true);

    const command = /^\/(help|new|settings|metrics|glossary)(?:\s|$)/i
      .exec(trimmedQuestion)?.[1]
      .toLowerCase();
    if (command === "help") {
      setPrompt("");
      setModelsOpen(false);
      setTourOpen(true);
      return;
    }
    if (command === "new") {
      startConversation();
      return;
    }
    if (command === "settings") {
      setPrompt("");
      setModelsOpen(false);
      setSettingsOpen(true);
      return;
    }
    if (command === "metrics" || command === "glossary") {
      showToast(
        (command === "metrics" ? "Metrics" : "Glossary") + " search needs a data connection",
        "warning",
      );
      return;
    }

    const conversationId = activeConversation?.id ?? createSessionId();
    if (thinkingConversationIds.has(conversationId)) return;
    followStreamRef.current = true;
    setShowJumpToLatest(false);
    setWalkthroughDismissed(true);

    const currentModelId = normalizeModelId(activeConversation?.modelId ?? selectedModelId);
    const currentCountryCode = normalizeCountryCode(
      activeConversation?.countryCode ?? selectedCountryCode,
    );
    const responseTablePageSize = settings.tablePageSize;
    const createdAt = new Date().toISOString();
    const userMessage: Message = {
      id: createId("msg"),
      role: "user",
      requestKind: "new",
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
          return {
            ...conversation,
            ...localConversationTitle(conversation, nextMessages),
            messages: nextMessages,
            updatedAt: createdAt,
          };
        });
      }

      const nextConversation: Conversation = {
        id: conversationId,
        title: titleFromUserMessages([trimmedQuestion]),
        titleSource: "local",
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
      const insight = await requestMcpInsight(
        mcpRequest.payload,
        requestAudit,
        streamingCallbacks(conversationId),
        mode,
      );
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

      streamProgress.interrupt(conversationId, responseMessage.id);

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
      clearGenerationStatus(conversationId);
      setThinkingConversationIds((current) => {
        const next = new Set(current);
        next.delete(conversationId);
        return next;
      });
    }
  };

  const handleEditUserMessage = async (messageId: string, newText: string, responseId?: string) => {
    const trimmedQuestion = newText.trim();
    if (!trimmedQuestion || !activeConversation) {
      return;
    }
    if (activeConversation.modelSelectionRequired) {
      setModelsOpen(true);
      showToast("Select the semantic model for this saved chat before continuing", "warning");
      return;
    }

    const currentModelId = normalizeModelId(activeConversation.modelId ?? selectedModelId);
    const responseTablePageSize = settings.tablePageSize;
    const createdAt = new Date().toISOString();
    const conversationId = activeConversation.id;
    if (thinkingConversationIds.has(conversationId)) return;

    const msgIndex = activeConversation.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    if (responseId) streamProgress.clear(responseId);
    else
      activeConversation.messages.slice(msgIndex + 1).forEach(({ id }) => streamProgress.clear(id));

    const previousMessages = activeConversation.messages.slice(0, msgIndex);
    const updatedUserMessage: Message = {
      ...activeConversation.messages[msgIndex],
      text: trimmedQuestion,
      createdAt,
    };
    const nextMessages = [...previousMessages, updatedUserMessage];

    setThinkingConversationIds((current) => new Set(current).add(conversationId));
    if (responseId) {
      setRegeneratingResponseIds((current) => ({ ...current, [conversationId]: responseId }));
    }

    if (!responseId) {
      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          return {
            ...conversation,
            ...localConversationTitle(conversation, nextMessages),
            messages: nextMessages,
            updatedAt: createdAt,
          };
        }),
      );
    }

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
      if (responseId) {
        const attempt = requestAudit;
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: recordRegenerationAttempt(
                    conversation.messages,
                    messageId,
                    attempt.request_id,
                    attempt.sent_at,
                  ),
                }
              : conversation,
          ),
        );
      }
      const insight = await requestMcpInsight(
        mcpRequest.payload,
        requestAudit,
        streamingCallbacks(conversationId),
        mode,
      );
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
                messages: responseId
                  ? replaceAssistantResponse(conversation.messages, responseId, responseMessage)
                  : [...conversation.messages, responseMessage],
                updatedAt: responseMessage.createdAt,
              }
            : conversation,
        ),
      );
    } catch (error) {
      if (responseId) {
        streamProgress.interrupt(conversationId, responseId, true);
        return;
      }
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

      streamProgress.interrupt(conversationId, responseMessage.id);

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
      clearGenerationStatus(conversationId);
      setRegeneratingResponseIds((current) => {
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      if (responseId && requestAudit) {
        const attempt = requestAudit;
        const completedAt = new Date().toISOString();
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: recordRegenerationAttempt(
                    conversation.messages,
                    messageId,
                    attempt.request_id,
                    attempt.sent_at,
                    completedAt,
                  ),
                }
              : conversation,
          ),
        );
      }
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
    void handleEditUserMessage(precedingUserMessage.id, precedingUserMessage.text, messageId);
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
        conversation.id === conversationId
          ? { ...conversation, title: trimmed, titleSource: "manual" }
          : conversation,
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
    <div className={`app-shell density-${settings.density} theme-${themeMode}`}>
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
          responseMode={mode}
          modelId={selectedModelId}
          openGuide={openSelectedModelGuide}
          showWalkthroughBanner={!walkthroughDismissed && !tourOpen && !activeConversation}
          openWalkthrough={() => setTourOpen(true)}
          themeMode={themeMode}
          toggleTheme={() => dispatch(uiActions.toggleThemeMode())}
          conversationTitle={activeConversation?.title}
          sidebarOpen={sidebarOpen}
          toggleSidebar={() => dispatch(uiActions.setSidebarOpen(!sidebarOpen))}
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
              showMagicHint={!magicHintDismissed}
              dismissMagicHint={() => setMagicHintDismissed(true)}
            />
          ) : (
            <>
              <div
                className="messages"
                ref={messagesRef}
                tabIndex={0}
                aria-label="Conversation messages"
              >
                {!activeConversation.messages.length && (
                  <div className="history-empty-notice" role="status">
                    No messages are saved in this browser for this conversation.
                  </div>
                )}
                {savedHistoryDisplayItems(
                  activeConversation.messages,
                  activeConversationIsThinking,
                ).map((item) =>
                  item.message ? (
                    <MessageBubble
                      key={item.key}
                      message={item.message}
                      tablePageSize={item.message.tablePageSize ?? settings.tablePageSize}
                      debugOpen={debugOpen}
                      feedback={feedback[item.message.id]}
                      copyMessage={copyMessage}
                      markFeedback={markFeedback}
                      onReportError={() => setIssueOpen(true)}
                      onEditUserMessage={handleEditUserMessage}
                      onRegenerateResponse={regenerateResponse}
                      busy={activeConversationIsThinking}
                      regenerating={item.message.id === activeRegeneratingResponseId}
                      streamProgress={streamProgress}
                      conversationId={activeConversation.id}
                    />
                  ) : (
                    <div className="assistant-row history-unavailable-row" key={item.key}>
                      <AssistantMark />
                      <div
                        className="history-unavailable-answer"
                        role="note"
                        aria-label="Saved answer unavailable"
                      >
                        No saved answer is available for this message.
                      </div>
                    </div>
                  ),
                )}
                {activeConversationIsThinking && !activeRegeneratingResponseId && (
                  <div
                    className="assistant-row pending-row"
                    key={`loading-${activeConversationId}`}
                  >
                    <AssistantMark />
                    <article className="response streaming-response">
                      <PendingResponse
                        progress={streamProgress}
                        conversationId={activeConversation.id}
                        tablePageSize={settings.tablePageSize}
                      />
                    </article>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="chat-latest-control">
                {showJumpToLatest && (
                  <button type="button" className="jump-to-latest" onClick={jumpToLatest}>
                    <ArrowDown size={15} aria-hidden="true" />
                    Jump to latest
                  </button>
                )}
              </div>

              <Composer
                prompt={prompt}
                setPrompt={setPrompt}
                submitPrompt={submitPrompt}
                showMagicHint={!magicHintDismissed}
                dismissMagicHint={() => setMagicHintDismissed(true)}
                busy={activeConversationIsThinking}
                modelSelectionRequired={activeConversation.modelSelectionRequired}
                modelId={normalizeModelId(activeConversation.modelId)}
                setModelId={setActiveConversationModel}
                modelsOpen={modelsOpen}
                setModelsOpen={setModelsOpen}
                modelLocked={
                  activeConversation.messages.length > 0 &&
                  !activeConversation.modelSelectionRequired
                }
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
          lastUserMessage={lastUserMessage}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          close={() => setSettingsOpen(false)}
          settings={settings}
          settingsSaveError={settingsSaveError}
          saveSettings={saveSettings}
          toggleDebug={() => saveSettings({ ...settings, keepDebugOpen: !debugOpen })}
          themeMode={themeMode}
          toggleTheme={() => dispatch(uiActions.toggleThemeMode())}
        />
      )}
      <AnimatePresence>
        {toast && (
          <ToastNotification
            key={toast.message}
            message={toast.message}
            tone={toast.tone}
            dismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export { AppRoot };
