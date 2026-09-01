import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquarePlus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
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

const dateBucketForConversation = (conversation: Conversation) => {
  const updated = new Date(conversation.updatedAt);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfUpdated = new Date(updated.getFullYear(), updated.getMonth(), updated.getDate());
  const dayDiff = Math.floor(
    (startOfToday.getTime() - startOfUpdated.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1 && dayDiff <= 7) return "This Week";
  if (dayDiff > 7 && dayDiff <= 14) return "Last Week";
  return "Past Months";
};

type DateGroup = {
  label: string;
  conversations: Conversation[];
};

const BUCKET_ORDER = ["Today", "Yesterday", "This Week", "Last Week", "Past Months"];

const groupHistoryByDate = (conversations: Conversation[]): DateGroup[] => {
  const dateGroups = new Map<string, Conversation[]>();

  conversations.forEach((conversation) => {
    const dateLabel = dateBucketForConversation(conversation);
    const list = dateGroups.get(dateLabel) ?? [];
    dateGroups.set(dateLabel, [...list, conversation]);
  });

  return BUCKET_ORDER.filter((label) => dateGroups.has(label)).map((label) => ({
    label,
    conversations: dateGroups.get(label)!,
  }));
};

type ModelGroup = {
  label: string;
  short: string;
  color: string;
  conversations: Conversation[];
};

const groupHistoryByModel = (conversations: Conversation[]): ModelGroup[] => {
  const modelGroups = new Map<string, { short: string; color: string; list: Conversation[] }>();

  conversations.forEach((conversation) => {
    const model = getModel(conversation.modelId);
    const label = model.nickname || model.short;
    const existing = modelGroups.get(label) ?? { short: model.short, color: model.color, list: [] };
    modelGroups.set(label, {
      short: model.short,
      color: model.color,
      list: [...existing.list, conversation],
    });
  });

  return [...modelGroups.entries()].map(([label, { short, color, list }]) => ({
    label,
    short,
    color,
    conversations: list,
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
  onRenameConversation,
  onTogglePinConversation,
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
  onRenameConversation?: (id: string, newTitle: string) => void;
  onTogglePinConversation?: (id: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  onSignOut?: () => void;
}) {
  const [groupBy, setGroupBy] = useState<"date" | "topic">("date");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const toggleTopicCollapse = (topicKey: string) => {
    setCollapsedTopics((prev) => ({
      ...prev,
      [topicKey]: !prev[topicKey],
    }));
  };

  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  useEffect(() => {
    const closePopovers = (event: PointerEvent) => {
      if (menuOpenId && !(event.target as HTMLElement).closest(".history-item-menu-wrap")) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("pointerdown", closePopovers);
    return () => document.removeEventListener("pointerdown", closePopovers);
  }, [menuOpenId]);

  const startRename = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditingTitle(conversation.title || latestUserPrompt(conversation));
  };

  const submitRename = () => {
    if (editingId && editingTitle.trim()) {
      onRenameConversation?.(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const pinnedConversations = conversations.filter((c) => c.pinned);
  const unpinnedConversations = conversations.filter((c) => !c.pinned);

  const renderHistoryItem = (conversation: Conversation) => {
    const isEditing = editingId === conversation.id;
    const isMenuActive = menuOpenId === conversation.id;
    const isActive = activeConversationId === conversation.id;

    if (isEditing) {
      return (
        <div className="history-item editing" key={conversation.id}>
          <input
            className="history-rename-input"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") cancelRename();
            }}
            autoFocus
          />
          <div className="history-rename-actions">
            <button
              type="button"
              className="rename-action-btn save"
              onClick={submitRename}
              title="Save Title"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              className="rename-action-btn cancel"
              onClick={cancelRename}
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`history-item ${isActive ? "active" : ""} ${conversation.pinned ? "is-pinned" : ""} ${isMenuActive ? "menu-open" : ""}`}
        key={conversation.id}
      >
        <button onClick={() => openConversation(conversation)}>
          <span>
            {conversation.pinned && <Pin className="history-pin-indicator" />}
            {clampText(conversation.title || latestUserPrompt(conversation), 50)}
          </span>
          <small>
            {groupBy === "date"
              ? `${getModel(conversation.modelId).short} / ${formatRelativeDate(conversation.updatedAt)}`
              : formatRelativeDate(conversation.updatedAt)}
          </small>
        </button>

        <div className="history-item-menu-wrap">
          <button
            type="button"
            className={`history-menu-trigger ${isMenuActive ? "active" : ""}`}
            aria-label="Chat Options"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(isMenuActive ? null : conversation.id);
            }}
          >
            <MoreHorizontal />
          </button>

          {isMenuActive && (
            <div className="history-popover-menu" role="menu">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(null);
                  onTogglePinConversation?.(conversation.id);
                }}
              >
                <Pin />
                <span>{conversation.pinned ? "Unpin Chat" : "Pin Chat"}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(null);
                  startRename(conversation);
                }}
              >
                <Pencil />
                <span>Edit Title</span>
              </button>

              <button
                type="button"
                className="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setMenuOpenId(null);
                  deleteConversation(conversation.id);
                }}
              >
                <Trash2 />
                <span>Delete Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className={`sidebar ${open ? "open" : "closed"}`}>
      <div className="sidebar-expanded-content" aria-hidden={!open} inert={!open}>
        <div className="side-head">
          <div className="side-brand">
            <AskBrandMark />
          </div>
          <IconButton label="Collapse Sidebar" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose />
          </IconButton>
        </div>

        <button className="new-chat" onClick={startConversation}>
          <MessageSquarePlus />
          <span>New Chat</span>
        </button>

        <label className="history-search">
          <Search />
          <input
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Search Chats"
            aria-label="Search Conversations"
          />
        </label>

        <div className="history-label-row">
          <div className="history-label">
            <span>Recents</span>
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
          {pinnedConversations.length > 0 && (
            <section className="history-date-section pinned-section">
              <div className="history-date-heading">
                <Pin className="pinned-heading-icon" />
                <span>Pinned</span>
                <strong>{pinnedConversations.length}</strong>
              </div>
              <div className="history-item-list">{pinnedConversations.map(renderHistoryItem)}</div>
            </section>
          )}

          {groupBy === "date"
            ? groupHistoryByDate(unpinnedConversations).map((dateGroup) => {
                const isCollapsed = Boolean(collapsedDates[dateGroup.label]);
                return (
                  <section
                    className={`history-date-section ${isCollapsed ? "is-collapsed" : ""}`}
                    key={dateGroup.label}
                  >
                    <div
                      className="history-date-heading clickable-heading"
                      onClick={() => toggleDateCollapse(dateGroup.label)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") toggleDateCollapse(dateGroup.label);
                      }}
                      title={
                        isCollapsed ? `Expand ${dateGroup.label}` : `Collapse ${dateGroup.label}`
                      }
                    >
                      <div className="history-heading-left">
                        {isCollapsed ? (
                          <ChevronRight className="history-collapse-icon" size={13} />
                        ) : (
                          <ChevronDown className="history-collapse-icon" size={13} />
                        )}
                        <CalendarDays size={13} />
                        <span>{dateGroup.label}</span>
                      </div>
                      <strong className="history-group-count">
                        {dateGroup.conversations.length}
                      </strong>
                    </div>

                    {!isCollapsed && (
                      <div className="history-item-list">
                        {dateGroup.conversations.map(renderHistoryItem)}
                      </div>
                    )}
                  </section>
                );
              })
            : groupHistoryByModel(unpinnedConversations).map((modelGroup) => {
                const isCollapsed = Boolean(collapsedTopics[modelGroup.label]);
                return (
                  <section
                    className={`history-date-section ${isCollapsed ? "is-collapsed" : ""}`}
                    key={modelGroup.label}
                  >
                    <div
                      className="history-date-heading clickable-heading"
                      onClick={() => toggleTopicCollapse(modelGroup.label)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          toggleTopicCollapse(modelGroup.label);
                      }}
                      title={
                        isCollapsed ? `Expand ${modelGroup.label}` : `Collapse ${modelGroup.label}`
                      }
                    >
                      <div className="history-heading-left">
                        {isCollapsed ? (
                          <ChevronRight className="history-collapse-icon" size={13} />
                        ) : (
                          <ChevronDown className="history-collapse-icon" size={13} />
                        )}
                        <span
                          className="history-model-badge"
                          style={{ backgroundColor: modelGroup.color }}
                        >
                          {modelGroup.short}
                        </span>
                        <span className="history-model-name">{modelGroup.label}</span>
                      </div>
                      <strong className="history-group-count">
                        {modelGroup.conversations.length}
                      </strong>
                    </div>

                    {!isCollapsed && (
                      <div className="history-item-list">
                        {modelGroup.conversations.map(renderHistoryItem)}
                      </div>
                    )}
                  </section>
                );
              })}
          {conversations.length === 0 && <p className="empty-history">No Saved Conversations</p>}
        </nav>

        <div className="sidebar-footer account-footer">
          <div className="sidebar-account-wrap expanded-account-wrap">
            <button
              className="sidebar-account-trigger"
              type="button"
              aria-label={`${user.name} account`}
            >
              <span className="avatar sidebar-avatar">{initials(user.name)}</span>
              <span className="sidebar-account-name">{user.name}</span>
            </button>
          </div>
          <IconButton
            label="Settings"
            className="sidebar-settings-btn footer-icon"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings />
          </IconButton>
        </div>
      </div>

      <div className="sidebar-collapsed-nav" aria-hidden={open} inert={open}>
        <button
          className="collapsed-brand-trigger"
          type="button"
          aria-label="Open Sidebar"
          data-tooltip="Open Sidebar"
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
        <IconButton label="Search Chats" onClick={() => setSidebarOpen(true)}>
          <Search />
        </IconButton>

        <div className="collapsed-footer">
          <IconButton
            label="Settings"
            className="footer-icon"
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
          </div>
        </div>
      </div>
    </aside>
  );
}
