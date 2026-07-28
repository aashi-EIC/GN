import {
  AlertTriangle,
  BookOpen,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Trash2,
} from "lucide-react";
import type { Conversation } from "../types/app";
import { formatRelativeDate } from "../utils/formatDate";
import { getModel } from "../../features/chat/utils/semantic";
import { IconButton } from "./ui/IconButton";

export function Sidebar({
  open,
  conversations,
  activeConversationId,
  historyQuery,
  setHistoryQuery,
  startConversation,
  openConversation,
  deleteConversation,
  setGuideOpen,
  setSidebarOpen,
}: {
  open: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  historyQuery: string;
  setHistoryQuery: (query: string) => void;
  startConversation: () => void;
  openConversation: (conversation: Conversation) => void;
  deleteConversation: (conversationId: string) => void;
  setGuideOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
}) {
  return (
    <aside className={`sidebar ${open ? "open" : "closed"}`}>
      {open && (
        <div className="side-head">
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
                  onClick={() => deleteConversation(conversation.id)}
                >
                  <Trash2 />
                </IconButton>
              </div>
            ))}
            {conversations.length === 0 && <p className="empty-history">No saved conversations</p>}
          </nav>
        </>
      ) : (
        <div className="sidebar-collapsed-nav">
          <IconButton label="Expand sidebar" onClick={() => setSidebarOpen(true)}>
            <PanelLeftOpen />
          </IconButton>
          <IconButton label="New Chat" onClick={startConversation}>
            <MessageSquarePlus />
          </IconButton>
        </div>
      )}
    </aside>
  );
}
