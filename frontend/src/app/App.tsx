import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppRouter } from "./router";
import { store, uiActions, useAppDispatch, useAppSelector } from "./store";
import { Composer } from "../features/chat/components/Composer";
import { MessageBubble } from "../features/chat/components/MessageBubble";
import { WelcomePanel } from "../features/chat/components/WelcomePanel";
import { LoadingScreen } from "../shared/components/LoadingScreen";
import { ErrorReportModal } from "../features/debug/components/ErrorReportModal";
import { GuideModal } from "../features/settings/components/GuideModal";
import { SettingsModal } from "../features/settings/components/SettingsModal";
import { TourModal } from "../shared/components/TourModal";
import { Navbar } from "../shared/components/Navbar";
import { Sidebar } from "../shared/components/Sidebar";
import { defaultSettings, storageKeys } from "../shared/config/storage";
import { loadFromStorage, saveToStorageDeferred } from "../shared/utils/storage";
import { apiScope } from "../features/auth/lib/msal";
import { LoginPage } from "../features/auth/pages/LoginPage";
import {
  buildMcpRequestPayload,
  formatUserFriendlyError,
  persistMcpRequestAudit,
  requestMcpInsight,
} from "../features/chat/services/mcp.service";
import {
  getUserSettings,
  updateUserSettings,
} from "../features/settings/services/settings.service";
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
import { accountToProfile } from "../shared/utils/identity";
import {
  createId,
  createSessionId,
  isSessionId,
  titleFromUserMessages,
} from "../shared/utils/session";
import { getModel, normalizeCountryCode, normalizeModelId } from "../features/chat/utils/semantic";
import { calculateTokenUsageAndCost } from "../features/chat/utils/tokenCost";
import { normalizeStoredConversation } from "../features/chat/utils/responseDisplay";

function AppRoot({ msalEnabled }: { msalEnabled: boolean }) {
  return <AppRouter shell={msalEnabled ? <MsalBackedShell /> : <LocalShell />} />;
}

function LocalShell() {
  const [localUser, setLocalUser] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<"signing-in" | "signing-out" | null>(null);

  const localSignIn = async (credentials: { username: string; name?: string }) => {
    const displayName =
      credentials.name || credentials.username.split("@")[0] || credentials.username;
    const userProfile: UserProfile = {
      name: displayName,
      email: credentials.username,
      authProvider: "Local Auth",
    };
    setLocalUser(userProfile);
  };

  const signOut = async () => {
    setAuthStatus("signing-out");
    try {
      setLocalUser(null);
    } finally {
      setAuthStatus(null);
    }
  };

  const acquireToken = async () => null;

  if (authStatus === "signing-out") {
    return <LoadingScreen text="Signing out..." />;
  }

  return (
    <IntelligenceApp
      user={localUser}
      entraAvailable={false}
      onLocalSignIn={localSignIn}
      onSignOut={signOut}
      acquireToken={acquireToken}
    />
  );
}

function MsalBackedShell() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const account = instance.getActiveAccount() ?? accounts[0];
  const profile = accountToProfile(account);
  const [localUser, setLocalUser] = useState<UserProfile | null>(null);
  const activeUser = (isAuthenticated ? profile : null) || localUser;
  const [authStatus, setAuthStatus] = useState<"signing-in" | "signing-out" | null>(null);

  const signIn = async () => {
    try {
      setAuthStatus("signing-in");
      await instance.loginRedirect({
        scopes: ["openid", "profile", "email", apiScope],
      });
    } finally {
      setAuthStatus(null);
    }
  };

  const localSignIn = async (credentials: { username: string; name?: string }) => {
    const displayName =
      credentials.name || credentials.username.split("@")[0] || credentials.username;
    const userProfile: UserProfile = {
      name: displayName,
      email: credentials.username,
      authProvider: "Local Auth",
    };
    setLocalUser(userProfile);
  };

  const signOut = async () => {
    try {
      setAuthStatus("signing-out");
      setLocalUser(null);
      if (isAuthenticated && account) {
        try {
          await instance.logoutRedirect({ account });
        } catch {
          instance.setActiveAccount(null);
        }
      }
    } finally {
      setAuthStatus(null);
    }
  };

  const acquireToken = async (forceRefresh = false) => {
    if (!account) {
      return null;
    }

    try {
      const result = await instance.acquireTokenSilent({
        account,
        scopes: [apiScope],
        forceRefresh,
      });
      return result.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await instance.acquireTokenRedirect({
          account,
          scopes: [apiScope],
        });
        return null;
      }
      throw error;
    }
  };

  if (authStatus === "signing-in") {
    return <LoadingScreen text="Signing in..." />;
  }

  if (authStatus === "signing-out") {
    return <LoadingScreen text="Signing out..." />;
  }

  return (
    <IntelligenceApp
      user={activeUser}
      entraAvailable
      onEntraSignIn={signIn}
      onLocalSignIn={localSignIn}
      onSignOut={signOut}
      acquireToken={acquireToken}
    />
  );
}

function IntelligenceApp({
  user,
  entraAvailable,
  onEntraSignIn,
  onLocalSignIn,
  onSignOut,
  acquireToken,
}: {
  user: UserProfile | null;
  entraAvailable: boolean;
  onEntraSignIn?: () => Promise<void>;
  onLocalSignIn?: (credentials: { username: string; name?: string }) => Promise<void>;
  onSignOut: () => void;
  acquireToken: (forceRefresh?: boolean) => Promise<string | null>;
}) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!user) {
      document.documentElement.dataset.theme = "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#ffffff");
      setLoading(false);
      return;
    }

    let active = true;
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const token = await acquireToken();
        if (!token) {
          if (active) setLoading(false);
          return;
        }
        const serverSettings = await getUserSettings(token);
        if (active && serverSettings) {
          setSettings({
            displayName: serverSettings.displayName ?? "",
            region: serverSettings.region ?? "Global",
            density: serverSettings.density ?? "comfortable",
            keepDebugOpen: serverSettings.keepDebugOpen ?? false,
          });
          if (serverSettings.theme) {
            dispatch(uiActions.setThemeMode(serverSettings.theme));
          }
        }
      } catch {
        // Silently use local settings when unauthenticated
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchSettings();
    return () => {
      active = false;
    };
  }, [user, acquireToken, dispatch]);

  const handleUpdateSettings = async (nextSettings: SettingsState) => {
    setSettings(nextSettings);
    try {
      const token = await acquireToken();
      const currentTheme = store.getState().ui.themeMode;
      await updateUserSettings(
        {
          ...nextSettings,
          theme: currentTheme,
        },
        token,
      );
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  };

  if (!user) {
    return (
      <LoginPage
        user={user}
        entraAvailable={entraAvailable}
        onEntraSignIn={onEntraSignIn}
        onLocalSignIn={onLocalSignIn}
      />
    );
  }

  if (loading) {
    return <LoadingScreen text="Loading settings..." />;
  }

  const effectiveUser = {
    ...user,
    name: settings.displayName.trim() || user.name,
  };

  return (
    <Workspace
      user={effectiveUser}
      settings={settings}
      setSettings={handleUpdateSettings}
      onSignOut={onSignOut}
      acquireToken={acquireToken}
    />
  );
}

function Workspace({
  user,
  settings,
  setSettings,
  onSignOut,
  acquireToken,
}: {
  user: UserProfile;
  settings: SettingsState;
  setSettings: (settings: SettingsState) => void;
  onSignOut: () => void;
  acquireToken: (forceRefresh?: boolean) => Promise<string | null>;
}) {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const debugOpen = useAppSelector((state) => state.ui.debugOpen);
  const themeMode = useAppSelector((state) => state.ui.themeMode);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadFromStorage<Conversation[]>(storageKeys.conversations, []).map((conversation) =>
      normalizeStoredConversation({
        ...conversation,
        id: isSessionId(conversation.id) ? conversation.id : createSessionId(),
      }),
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
  const [isThinking, setIsThinking] = useState(false);
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

  useQuery({
    queryKey: ["workspace-status", user.email],
    queryFn: async () => ({
      label: "Ready",
      checkedAt: new Date().toISOString(),
    }),
  });

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
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
    saveToStorageDeferred(storageKeys.conversations, conversations);
  }, [conversations]);

  useEffect(() => {
    dispatch(uiActions.setDebugOpen(settings.keepDebugOpen));
  }, [dispatch, settings.keepDebugOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeMode === "dark" ? "#25282d" : "#ffffff");

    document.title = "Conversational BI | Gracenote";
  }, [themeMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages.length, isThinking]);

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

  const closeTour = async () => {
    setTourOpen(false);
    try {
      const token = await acquireToken();
      await updateUserSettings(
        {
          ...settings,
          theme: themeMode,
          tourSeen: true,
        },
        token,
      );
    } catch (err) {
      console.error("Failed to save tour status:", err);
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
    if (!trimmedQuestion || isThinking) {
      return;
    }

    const currentModelId = normalizeModelId(activeConversation?.modelId ?? selectedModelId);
    const currentCountryCode = normalizeCountryCode(
      activeConversation?.countryCode ?? selectedCountryCode,
    );
    const createdAt = new Date().toISOString();
    const conversationId = activeConversation?.id ?? createSessionId();
    const userMessage: Message = {
      id: createId("msg"),
      role: "user",
      text: trimmedQuestion,
      createdAt,
    };

    setPrompt("");
    setModelsOpen(false);
    setIsThinking(true);

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
      const token = await acquireToken();
      const mcpRequest = buildMcpRequestPayload({
        conversationId,
        modelId: currentModelId,
        prompt: trimmedQuestion,
        debug: debugOpen,
      });
      requestAudit = mcpRequest.audit;
      persistMcpRequestAudit(requestAudit);
      let answer;
      try {
        answer = await requestMcpInsight(mcpRequest.payload, requestAudit, token);
      } catch (err) {
        if (err instanceof Error && err.message.includes("Invalid or expired access token")) {
          const freshToken = await acquireToken(true);
          if (freshToken) {
            answer = await requestMcpInsight(mcpRequest.payload, requestAudit, freshToken);
          } else {
            throw err;
          }
        } else {
          throw err;
        }
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
        mcpRequest: requestAudit,
        tokenUsage,
        ...answer,
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
      setIsThinking(false);
    }
  };

  const handleEditUserMessage = async (messageId: string, newText: string) => {
    const trimmedQuestion = newText.trim();
    if (!trimmedQuestion || isThinking || !activeConversation) {
      return;
    }

    const currentModelId = normalizeModelId(activeConversation.modelId ?? selectedModelId);
    const createdAt = new Date().toISOString();
    const conversationId = activeConversation.id;

    const msgIndex = activeConversation.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const previousMessages = activeConversation.messages.slice(0, msgIndex);
    const updatedUserMessage: Message = {
      ...activeConversation.messages[msgIndex],
      text: trimmedQuestion,
      createdAt,
    };
    const nextMessages = [...previousMessages, updatedUserMessage];

    setIsThinking(true);

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
      const token = await acquireToken();
      const mcpRequest = buildMcpRequestPayload({
        conversationId,
        modelId: currentModelId,
        prompt: trimmedQuestion,
        debug: debugOpen,
      });
      requestAudit = mcpRequest.audit;
      persistMcpRequestAudit(requestAudit);
      let answer;
      try {
        answer = await requestMcpInsight(mcpRequest.payload, requestAudit, token);
      } catch (err) {
        if (err instanceof Error && err.message.includes("Invalid or expired access token")) {
          const freshToken = await acquireToken(true);
          if (freshToken) {
            answer = await requestMcpInsight(mcpRequest.payload, requestAudit, freshToken);
          } else {
            throw err;
          }
        } else {
          throw err;
        }
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
        mcpRequest: requestAudit,
        tokenUsage,
        ...answer,
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
      setIsThinking(false);
    }
  };

  const regenerateResponse = (messageId: string) => {
    if (!activeConversation || isThinking) return;

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
    showToast("Settings saved");
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
        setSettingsOpen={setSettingsOpen}
        onSignOut={onSignOut}
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
                    debugOpen={debugOpen}
                    feedback={feedback[message.id]}
                    copyMessage={copyMessage}
                    markFeedback={markFeedback}
                    onReportError={() => setIssueOpen(true)}
                    onEditUserMessage={handleEditUserMessage}
                    onRegenerateResponse={regenerateResponse}
                    busy={isThinking}
                  />
                ))}
                {isThinking && (
                  <div className="assistant-row">
                    <div className="ai-mark">
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
                busy={isThinking}
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
          saveSettings={saveSettings}
          toggleDebug={() => saveSettings({ ...settings, keepDebugOpen: !debugOpen })}
          themeMode={themeMode}
          toggleTheme={() => dispatch(uiActions.toggleThemeMode())}
          onSignOut={onSignOut}
        />
      )}
      {toast && <div className={`toast ${toast.tone}`}>{toast.message}</div>}
    </div>
  );
}

export { AppRoot };
