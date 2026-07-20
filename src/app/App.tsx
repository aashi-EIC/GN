import { InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { useQuery } from "@tanstack/react-query";
import { Bug, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppRouter } from "./router";
import { uiActions, useAppDispatch, useAppSelector } from "./store";
import { Composer } from "../components/chat/Composer";
import { MessageBubble } from "../components/chat/MessageBubble";
import { WelcomePanel } from "../components/chat/WelcomePanel";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { ErrorReportModal } from "../components/modals/ErrorReportModal";
import { GuideModal } from "../components/modals/GuideModal";
import { SettingsModal } from "../components/modals/SettingsModal";
import { TourModal } from "../components/modals/TourModal";
import { Navbar } from "../components/navbar/Navbar";
import { Sidebar } from "../components/sidebar/Sidebar";
import { defaultSettings, storageKeys } from "../config/storage";
import { apiScope } from "../lib/msal";
import { LoginPage } from "../pages/Login/LoginPage";
import {
  buildMcpRequestPayload,
  persistMcpRequestAudit,
  requestMcpInsight,
} from "../services/mcp.service";
import {
  loginWithCloudBi,
  logoutCloudBiSession,
  restoreCloudBiSession,
} from "../services/cloudBiAuth.service";
import type {
  CloudBiLoginCredentials,
  Conversation,
  FeedbackValue,
  IssueReport,
  McpRequestAudit,
  Message,
  SettingsState,
  ToastState,
  UserProfile,
} from "../types/app";
import type { CountryCode, ModelId } from "../types/semantic";
import { copyText, downloadJson, messageToPlainText } from "../utils/clipboard";
import { accountToProfile } from "../utils/identity";
import { createId, titleFromQuestion } from "../utils/session";
import { getModel, normalizeCountryCode, normalizeModelId } from "../utils/semantic";
import { loadFromStorage, saveToStorage } from "../utils/storage";

function AppRoot({ msalEnabled }: { msalEnabled: boolean }) {
  const shell = msalEnabled ? <MsalBackedShell /> : <CloudBiOnlyShell />;

  return <AppRouter shell={shell} />;
}

function MsalBackedShell() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const account = instance.getActiveAccount() ?? accounts[0];
  const profile = accountToProfile(account);
  const [cloudBiUser, setCloudBiUser] = useState<UserProfile | null>(() =>
    usableCloudBiProfile(loadFromStorage<UserProfile | null>(storageKeys.user, null)),
  );
  const activeUser = cloudBiUser ?? (isAuthenticated ? profile : null);
  const [ssoReady, setSsoReady] = useState(false);
  const ssoAttempted = useRef(false);

  useEffect(() => {
    if (ssoAttempted.current || inProgress !== InteractionStatus.None) {
      return undefined;
    }

    ssoAttempted.current = true;
    let active = true;

    const complete = () => {
      if (active) {
        setSsoReady(true);
      }
    };

    const runStartupSso = async () => {
      const preferredProvider = localStorage.getItem(storageKeys.ssoProvider);

      if (preferredProvider === "cloud-bi") {
        const restoredCloudBi = await tryRestoreCloudBiSession();
        if (restoredCloudBi) {
          if (active) {
            saveToStorage(storageKeys.user, restoredCloudBi);
            setCloudBiUser(restoredCloudBi);
          }
          complete();
          return;
        }
      }

      const cachedAccount = instance.getActiveAccount() ?? accounts[0];
      if (cachedAccount) {
        instance.setActiveAccount(cachedAccount);
        localStorage.setItem(storageKeys.ssoProvider, "entra");
        localStorage.removeItem(storageKeys.user);
        if (active) {
          setCloudBiUser(null);
        }
        complete();
        return;
      }

      try {
        const result = await instance.ssoSilent({
          scopes: ["openid", "profile", "email", apiScope],
        });
        if (result.account) {
          instance.setActiveAccount(result.account);
          localStorage.setItem(storageKeys.ssoProvider, "entra");
          localStorage.removeItem(storageKeys.user);
          if (active) {
            setCloudBiUser(null);
          }
          complete();
          return;
        }
      } catch {
        // Silent SSO is opportunistic; interactive login remains available.
      }

      const restoredCloudBi = await tryRestoreCloudBiSession();
      if (restoredCloudBi && active) {
        saveToStorage(storageKeys.user, restoredCloudBi);
        setCloudBiUser(restoredCloudBi);
      }
      complete();
    };

    runStartupSso().catch(complete);

    return () => {
      active = false;
    };
  }, [accounts, inProgress, instance]);

  const signIn = async () => {
    const result = await instance.loginPopup({
      scopes: ["openid", "profile", "email", apiScope],
    });
    if (result.account) {
      instance.setActiveAccount(result.account);
    }
    localStorage.setItem(storageKeys.ssoProvider, "entra");
    localStorage.removeItem(storageKeys.user);
    setCloudBiUser(null);
  };

  const signOut = async () => {
    if (!cloudBiUser && isAuthenticated && account) {
      localStorage.removeItem(storageKeys.ssoProvider);
      instance.logoutRedirect({ account });
      return;
    }
    await logoutCloudBiSession().catch(() => undefined);
    localStorage.removeItem(storageKeys.ssoProvider);
    localStorage.removeItem(storageKeys.user);
    setCloudBiUser(null);
  };

  const signInWithCloudBi = async (credentials: CloudBiLoginCredentials) => {
    const profile = await loginWithCloudBi(credentials);
    saveToStorage(storageKeys.user, profile);
    localStorage.setItem(storageKeys.ssoProvider, "cloud-bi");
    setCloudBiUser(profile);
  };

  const acquireToken = async () => {
    if (cloudBiUser?.accessToken) {
      return cloudBiUser.accessToken;
    }

    if (!account) {
      return null;
    }

    try {
      const result = await instance.acquireTokenSilent({
        account,
        scopes: [apiScope],
      });
      return result.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const result = await instance.acquireTokenPopup({
          account,
          scopes: [apiScope],
        });
        return result.accessToken;
      }
      throw error;
    }
  };

  if (!ssoReady || inProgress === "startup" || inProgress === "handleRedirect") {
    return <LoadingScreen />;
  }

  return (
    <IntelligenceApp
      user={activeUser}
      entraAvailable
      onEntraSignIn={signIn}
      onCloudBiSignIn={signInWithCloudBi}
      onSignOut={signOut}
      acquireToken={acquireToken}
    />
  );
}

function CloudBiOnlyShell() {
  const [user, setUser] = useState<UserProfile | null>(() =>
    usableCloudBiProfile(loadFromStorage<UserProfile | null>(storageKeys.user, null)),
  );
  const [ssoReady, setSsoReady] = useState(false);

  useEffect(() => {
    let active = true;

    restoreCloudBiSession()
      .then((profile) => {
        if (!active || !profile) {
          return;
        }
        saveToStorage(storageKeys.user, profile);
        localStorage.setItem(storageKeys.ssoProvider, "cloud-bi");
        setUser(profile);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setSsoReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = async (credentials: CloudBiLoginCredentials) => {
    const profile = await loginWithCloudBi(credentials);
    saveToStorage(storageKeys.user, profile);
    localStorage.setItem(storageKeys.ssoProvider, "cloud-bi");
    setUser(profile);
  };

  const signOut = async () => {
    await logoutCloudBiSession().catch(() => undefined);
    localStorage.removeItem(storageKeys.ssoProvider);
    localStorage.removeItem(storageKeys.user);
    setUser(null);
  };

  if (!ssoReady) {
    return <LoadingScreen />;
  }

  return (
    <IntelligenceApp
      user={user}
      entraAvailable={false}
      onCloudBiSignIn={signIn}
      onSignOut={signOut}
      acquireToken={async () => user?.accessToken ?? null}
    />
  );
}

async function tryRestoreCloudBiSession() {
  try {
    return usableCloudBiProfile(await restoreCloudBiSession());
  } catch {
    return null;
  }
}

function usableCloudBiProfile(profile: UserProfile | null) {
  if (!profile || profile.authProvider !== "Cloud BI ID" || !profile.accessToken) {
    return null;
  }

  if (!profile.tokenExpiresAt) {
    return profile;
  }

  const expiresAt = Date.parse(profile.tokenExpiresAt);
  if (!Number.isFinite(expiresAt)) {
    return profile;
  }

  return expiresAt > Date.now() + 60_000 ? profile : null;
}

function IntelligenceApp({
  user,
  entraAvailable,
  onEntraSignIn,
  onCloudBiSignIn,
  onSignOut,
  acquireToken,
}: {
  user: UserProfile | null;
  entraAvailable: boolean;
  onEntraSignIn?: () => Promise<void>;
  onCloudBiSignIn: (credentials: CloudBiLoginCredentials) => Promise<void>;
  onSignOut: () => void;
  acquireToken: () => Promise<string | null>;
}) {
  const [settings, setSettings] = useState<SettingsState>(() =>
    loadFromStorage(storageKeys.settings, defaultSettings),
  );

  if (!user) {
    return (
      <LoginPage
        entraAvailable={entraAvailable}
        onEntraSignIn={onEntraSignIn}
        onCloudBiSignIn={onCloudBiSignIn}
      />
    );
  }

  const effectiveUser = {
    ...user,
    name: settings.displayName.trim() || user.name,
  };

  return (
    <Workspace
      user={effectiveUser}
      settings={settings}
      setSettings={setSettings}
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
  acquireToken: () => Promise<string | null>;
}) {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const debugOpen = useAppSelector((state) => state.ui.debugOpen);
  const themeMode = useAppSelector((state) => state.ui.themeMode);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadFromStorage<Conversation[]>(storageKeys.conversations, []),
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversations[0]?.id ?? null,
  );
  const [selectedModelId, setSelectedModelId] = useState<ModelId>(
    normalizeModelId(conversations[0]?.modelId),
  );
  const [selectedCountryCode, setSelectedCountryCode] = useState<CountryCode>(
    normalizeCountryCode(conversations[0]?.countryCode),
  );
  const [prompt, setPrompt] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>(() =>
    loadFromStorage<Record<string, FeedbackValue>>(storageKeys.feedback, {}),
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const workspaceStatus = useQuery({
    queryKey: ["workspace-status", user.email],
    queryFn: async () => ({
      label: "Ready",
      checkedAt: new Date().toISOString(),
    }),
    staleTime: 60_000,
  });

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const selectedModel = getModel(selectedModelId);
  const recentConversations = useMemo(
    () =>
      [...conversations]
        .sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        )
        .slice(0, 10),
    [conversations],
  );
  const filteredConversations = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) {
      return recentConversations;
    }
    return recentConversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(query),
    );
  }, [recentConversations, historyQuery]);

  useEffect(() => {
    saveToStorage(storageKeys.conversations, conversations);
  }, [conversations]);

  useEffect(() => {
    saveToStorage(storageKeys.feedback, feedback);
  }, [feedback]);

  useEffect(() => {
    dispatch(uiActions.setDebugOpen(settings.keepDebugOpen));
  }, [dispatch, settings.keepDebugOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      themeMode === "dark" ? "#25282d" : "#ffffff",
    );
    localStorage.setItem(storageKeys.theme, themeMode);
    document.title = "Video MCP Server - Gracenote";
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

  const showToast = (message: string, tone: ToastState["tone"] = "success") => {
    setToast({ message, tone });
  };

  const closeTour = () => {
    saveToStorage(storageKeys.tourSeen, true);
    setTourOpen(false);
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

  const setActiveConversationCountry = (nextCountryCode: CountryCode) => {
    setSelectedCountryCode(nextCountryCode);
    if (!activeConversation) {
      return;
    }

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversation.id
          ? { ...conversation, countryCode: nextCountryCode }
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
    const nextConversations = conversations.filter(
      (conversation) => conversation.id !== conversationId,
    );
    setConversations(nextConversations);
    if (activeConversationId === conversationId) {
      const nextActive = nextConversations[0] ?? null;
      setActiveConversationId(nextActive?.id ?? null);
      setSelectedModelId(normalizeModelId(nextActive?.modelId ?? selectedModelId));
      setSelectedCountryCode(normalizeCountryCode(nextActive?.countryCode ?? selectedCountryCode));
    }
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
    const conversationId = activeConversation?.id ?? createId("conv");
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
        return current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: [...conversation.messages, userMessage],
                updatedAt: createdAt,
              }
            : conversation,
        );
      }

      const nextConversation: Conversation = {
        id: conversationId,
        title: titleFromQuestion(trimmedQuestion),
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
        user,
        conversationId,
        modelId: currentModelId,
        countryCode: currentCountryCode,
        prompt: trimmedQuestion,
        token,
      });
      requestAudit = mcpRequest.audit;
      persistMcpRequestAudit(requestAudit);
      const answer = await requestMcpInsight(mcpRequest.payload, requestAudit);
      const responseMessage: Message = {
        id: createId("msg"),
        role: "assistant",
        createdAt: new Date().toISOString(),
        mcpRequest: requestAudit,
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
      const message =
        error instanceof Error
          ? error.message
          : "The analytics engine could not complete this request.";
      const responseMessage: Message = {
        id: createId("msg"),
        role: "assistant",
        createdAt: new Date().toISOString(),
        text: message,
        metrics: [
          {
            label: "Request status",
            value: "Needs review",
            tone: "watch",
          },
        ],
        debug: [
          ...(requestAudit
            ? [
                {
                  stage: "mcp_request_payload",
                  status: "success" as const,
                  detail: "Payload prepared for MCP host",
                  payload: requestAudit,
                },
              ]
            : []),
          {
            stage: "request_error",
            status: "warning",
            detail: message,
          },
        ],
        mcpRequest: requestAudit ?? undefined,
        mcpResponseSource: "configured-host",
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

  const saveSettings = (nextSettings: SettingsState) => {
    saveToStorage(storageKeys.settings, nextSettings);
    setSettings(nextSettings);
    dispatch(uiActions.setDebugOpen(nextSettings.keepDebugOpen));
    showToast("Settings saved");
  };

  const submitIssue = (issue: IssueReport) => {
    const issues = loadFromStorage<IssueReport[]>(storageKeys.issues, []);
    saveToStorage(storageKeys.issues, [issue, ...issues]);
    setIssueOpen(false);
    showToast(`Issue ${issue.id} saved`);
  };

  const copyMessage = async (message: Message) => {
    await copyText(messageToPlainText(message));
    showToast("Response copied");
  };

  const markFeedback = (messageId: string, value: FeedbackValue) => {
    setFeedback((current) => ({ ...current, [messageId]: value }));
    showToast(value === "helpful" ? "Marked helpful" : "Feedback recorded");
  };

  const exportConversation = () => {
    if (!activeConversation) {
      showToast("Start a conversation before exporting", "warning");
      return;
    }
    downloadJson(`${activeConversation.title.replace(/[^a-z0-9]+/gi, "-")}.json`, {
      exportedAt: new Date().toISOString(),
      conversation: activeConversation,
      feedback: Object.fromEntries(
        Object.entries(feedback).filter(([messageId]) =>
          activeConversation.messages.some((message) => message.id === messageId),
        ),
      ),
    });
    showToast("Conversation exported");
  };

  return (
    <div className={`app-shell density-${settings.density} theme-${themeMode}`}>
      <Sidebar
        open={sidebarOpen}
        conversations={filteredConversations}
        activeConversationId={activeConversationId}
        historyQuery={historyQuery}
        setHistoryQuery={setHistoryQuery}
        startConversation={startConversation}
        openConversation={openConversation}
        deleteConversation={deleteConversation}
        setGuideOpen={setGuideOpen}
        setIssueOpen={setIssueOpen}
        setSidebarOpen={(open) => dispatch(uiActions.setSidebarOpen(open))}
      />

      <section className="workspace">
        <Navbar
          user={user}
          sidebarOpen={sidebarOpen}
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
          debugOpen={debugOpen}
          toggleDebug={() => dispatch(uiActions.setDebugOpen(!debugOpen))}
          themeMode={themeMode}
          toggleTheme={() => dispatch(uiActions.toggleThemeMode())}
          setSidebarOpen={(open) => dispatch(uiActions.setSidebarOpen(open))}
          setGuideOpen={setGuideOpen}
          setTourOpen={setTourOpen}
          setIssueOpen={setIssueOpen}
          setSettingsOpen={setSettingsOpen}
          exportConversation={exportConversation}
          onSignOut={onSignOut}
          statusLabel={workspaceStatus.data?.label ?? "Ready"}
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
              countryCode={selectedCountryCode}
              setCountryCode={setSelectedCountryCode}
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
                    showToast={showToast}
                  />
                ))}
                {isThinking && (
                  <div className="assistant-row">
                    <div className="ai-mark">
                      <Sparkles />
                    </div>
                    <div className="thinking">
                      <i />
                      <i />
                      <i />
                      Running governed calculations
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
                setCountryCode={setActiveConversationCountry}
              />
            </>
          )}
        </main>
      </section>

      <button className="report-fab" onClick={() => setIssueOpen(true)} type="button">
        <Bug />
        <span>Report errors</span>
      </button>

      {tourOpen && <TourModal close={closeTour} modelId={selectedModelId} />}
      {guideOpen && (
        <GuideModal
          close={() => setGuideOpen(false)}
          modelId={normalizeModelId(activeConversation?.modelId ?? selectedModelId)}
        />
      )}
      {issueOpen && (
        <ErrorReportModal
          close={() => setIssueOpen(false)}
          submitIssue={submitIssue}
          activeConversationId={activeConversationId}
          modelId={normalizeModelId(activeConversation?.modelId ?? selectedModelId)}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          close={() => setSettingsOpen(false)}
          settings={settings}
          saveSettings={saveSettings}
        />
      )}
      {toast && <div className={`toast ${toast.tone}`}>{toast.message}</div>}
    </div>
  );
}

export { AppRoot };
