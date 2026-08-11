import {
  CalendarDays,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Tags,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { Conversation, UserProfile } from "../types/app";
import { formatRelativeDate } from "../utils/formatDate";
import { getModel } from "../../features/chat/utils/semantic";
import { IconButton } from "./ui/IconButton";
import { initials } from "../utils/identity";
import { AskBrandMark } from "./Brand";

const clampText = (value: string, maxLength: number) => {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 3).trim()}...`;
};

const latestUserPrompt = (conversation: Conversation) =>
  [...conversation.messages].reverse().find((message) => message.role === "user")?.text ??
  conversation.title;

const topicFromConversation = (conversation: Conversation) => {
  const topic = conversation.title && conversation.title !== "New Chat"
    ? conversation.title
    : latestUserPrompt(conversation);
  return clampText(topic, 30) || "General analysis";
};

const dateBucketForConversation = (conversation: Conversation) => {
  const updated = new Date(conversation.updatedAt);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfUpdated = new Date(updated.getFullYear(), updated.getMonth(), updated.getDate());
  const dayDiff = Math.floor(
    (startOfToday.getTime() - startOfUpdated.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dayDiff === 0) return "Today";
  if (dayDiff === -1) return "Tomorrow";
  if (dayDiff === 1) return "Yesterday";

  return updated.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

type DateGroup = {
  label: string;
  conversations: Conversation[];
};

const groupHistoryByDate = (conversations: Conversation[]): DateGroup[] => {
  const dateGroups = new Map<string, Conversation[]>();

  conversations.forEach((conversation) => {
    const dateLabel = dateBucketForConversation(conversation);
    const list = dateGroups.get(dateLabel) ?? [];
    dateGroups.set(dateLabel, [...list, conversation]);
  });

  return [...dateGroups.entries()].map(([label, conversations]) => ({
    label,
    conversations,
  }));
};

type TopicGroup = {
  label: string;
  conversations: Conversation[];
};

const groupHistoryByTopic = (conversations: Conversation[]): TopicGroup[] => {
  const topicGroups = new Map<string, Conversation[]>();

  conversations.forEach((conversation) => {
    const topic = topicFromConversation(conversation);
    const list = topicGroups.get(topic) ?? [];
    topicGroups.set(topic, [...list, conversation]);
  });

  return [...topicGroups.entries()].map(([label, conversations]) => ({
    label,
    conversations,
  }));
};

export function Sidebar({
  open,
  user,
  conversations,
  activeConversationId,
  historyQuery,
  setHistoryQuery,
  startConversation,
  openConversation,
  deleteConversation,
  setGuideOpen,
  setSidebarOpen,
  setSettingsOpen,
}: {
  open: boolean;
  user: UserProfile;
  conversations: Conversation[];
  activeConversationId: string | null;
  historyQuery: string;
  setHistoryQuery: (query: string) => void;
  startConversation: () => void;
  openConversation: (conversation: Conversation) => void;
  deleteConversation: (conversationId: string) => void;
  setGuideOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  onSignOut?: () => void;
}) {
  const [groupBy, setGroupBy] = useState<"date" | "topic">("date");

  return (
    <aside className={`sidebar ${open ? "open" : "closed"}`}>
      {open && (
        <div className="side-head">
          <div className="side-brand">
            <AskBrandMark />
          </div>
          <IconButton label="Collapse sidebar" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose />
          </IconButton>
        </div>
      )}

      {open ? (
        <>
          <button className="new-chat" onClick={startConversation}>
            <MessageSquarePlus />
            <span>New Chat</span>
          </button>

          <label className="history-search">
            <Search />
            <input
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="Search chats"
              aria-label="Search conversations"
            />
          </label>

          <div className="history-label-row">
            <div className="history-label">
              <span>Recents</span>
              <strong>{conversations.length}</strong>
            </div>
            <div className="history-toggle-group">
              <button
                type="button"
                className={groupBy === "date" ? "active" : ""}
                onClick={() => setGroupBy("date")}
                title="Group by Date"
              >
                Date
              </button>
              <button
                type="button"
                className={groupBy === "topic" ? "active" : ""}
                onClick={() => setGroupBy("topic")}
                title="Group by Topic"
              >
                Topic
              </button>
            </div>
          </div>

          <nav className="history" aria-label="Conversation history">
            {groupBy === "date"
              ? groupHistoryByDate(conversations).map((dateGroup) => (
                  <section className="history-date-section" key={dateGroup.label}>
                    <div className="history-date-heading">
                      <CalendarDays />
                      <span>{dateGroup.label}</span>
                      <strong>{dateGroup.conversations.length}</strong>
                    </div>

                    <div className="history-item-list">
                      {dateGroup.conversations.map((conversation) => (
                        <div
                          className={`history-item ${
                            activeConversationId === conversation.id ? "active" : ""
                          }`}
                          key={conversation.id}
                        >
                          <button onClick={() => openConversation(conversation)}>
                            <span>{clampText(latestUserPrompt(conversation), 54)}</span>
                            <small>
                              {getModel(conversation.modelId).short} /{" "}
                              {formatRelativeDate(conversation.updatedAt)}
                            </small>
                          </button>
                          <IconButton
                            label="Delete conversation"
                            className="history-delete-btn"
                            onClick={() => deleteConversation(conversation.id)}
                          >
                            <Trash2 />
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              : groupHistoryByTopic(conversations).map((topicGroup) => (
                  <section className="history-date-section" key={topicGroup.label}>
                    <div className="history-date-heading">
                      <Tags />
                      <span>{topicGroup.label}</span>
                      <strong>{topicGroup.conversations.length}</strong>
                    </div>

                    <div className="history-item-list">
                      {topicGroup.conversations.map((conversation) => (
                        <div
                          className={`history-item ${
                            activeConversationId === conversation.id ? "active" : ""
                          }`}
                          key={conversation.id}
                        >
                          <button onClick={() => openConversation(conversation)}>
                            <span>{clampText(latestUserPrompt(conversation), 54)}</span>
                            <small>
                              {getModel(conversation.modelId).short} /{" "}
                              {formatRelativeDate(conversation.updatedAt)}
                            </small>
                          </button>
                          <IconButton
                            label="Delete conversation"
                            className="history-delete-btn"
                            onClick={() => deleteConversation(conversation.id)}
                          >
                            <Trash2 />
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
            {conversations.length === 0 && <p className="empty-history">No saved conversations</p>}
          </nav>

          <div className="sidebar-footer gemini-account-footer">
            <div className="sidebar-account-wrap expanded-account-wrap">
              <button
                className="sidebar-account-trigger"
                type="button"
                aria-label={`${user.name} account`}
              >
                <span className="avatar sidebar-avatar">{initials(user.name)}</span>
                <span className="sidebar-account-name">{user.name}</span>
              </button>
              <div className="sidebar-account-card" role="tooltip">
                <strong>{user.authProvider}</strong>
                <span>{user.name}</span>
                <span>{user.email}</span>
              </div>
            </div>
            <IconButton
              label="Settings"
              className="sidebar-settings-btn gemini-footer-icon"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings />
            </IconButton>
          </div>
        </>
      ) : (
        <div className="sidebar-collapsed-nav">
          <button
            className="collapsed-brand-trigger"
            type="button"
            aria-label="Open sidebar"
            data-tooltip="Open sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="collapsed-brand-default">
              <AskBrandMark />
            </span>
            <PanelLeftOpen className="collapsed-brand-open-icon" />
          </button>
          <IconButton label="New Chat" onClick={startConversation}>
            <MessageSquarePlus />
          </IconButton>
          <IconButton label="Search chats" onClick={() => setSidebarOpen(true)}>
            <Search />
          </IconButton>

          <div className="collapsed-footer">
            <IconButton
              label="Settings"
              className="gemini-footer-icon"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings />
            </IconButton>
            <div className="sidebar-account-wrap">
              <button
                className="avatar sidebar-avatar collapsed-avatar"
                type="button"
                aria-label={`${user.name} account`}
              >
                {initials(user.name)}
              </button>
              <div className="sidebar-account-card collapsed-account-card" role="tooltip">
                <strong>{user.authProvider}</strong>
                <span>{user.name}</span>
                <span>{user.email}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}


