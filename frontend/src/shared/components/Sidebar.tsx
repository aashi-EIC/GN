import {
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import type { Conversation, UserProfile } from "../types/app";
import { formatRelativeDate } from "../utils/formatDate";
import { getModel } from "../../features/chat/utils/semantic";
import { IconButton } from "./ui/IconButton";
import { initials } from "../utils/identity";
import { AskBrandMark } from "./Brand";

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

          <div className="history-label">
            <span>Previous chats</span>
            <strong>{conversations.length}</strong>
          </div>

          <nav className="history" aria-label="Conversation history">
            {conversations.map((conversation) => (
              <div
                className={`history-item ${
                  activeConversationId === conversation.id ? "active" : ""
                }`}
                key={conversation.id}
              >
                <button onClick={() => openConversation(conversation)}>
                  <span>{conversation.title}</span>
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
            {conversations.length === 0 && <p className="empty-history">No saved conversations</p>}
          </nav>

          {/* Bottom Sidebar Footer: User profile & Settings Gear Icon */}
          <div className="sidebar-footer">
            <div className="sidebar-user-info" title={user.email}>
              <div className="avatar sidebar-avatar">{initials(user.name)}</div>
              <div className="user-details">
                <span className="user-name">{user.name}</span>
                <span className="user-tier">Conversational BI</span>
              </div>
            </div>
            <IconButton
              label="Settings"
              className="sidebar-settings-btn"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings />
            </IconButton>
          </div>
        </>
      ) : (
        <div className="sidebar-collapsed-nav">
          <div className="collapsed-brand" title="Conversational BI">
            <AskBrandMark />
          </div>
          <IconButton label="Expand sidebar" onClick={() => setSidebarOpen(true)}>
            <PanelLeftOpen />
          </IconButton>
          <IconButton label="New Chat" onClick={startConversation}>
            <MessageSquarePlus />
          </IconButton>
          <IconButton label="Search chats" onClick={() => setSidebarOpen(true)}>
            <Search />
          </IconButton>

          <div className="collapsed-footer">
            <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
              <Settings />
            </IconButton>
            <div className="avatar sidebar-avatar collapsed-avatar" title={user.name}>
              {initials(user.name)}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}


