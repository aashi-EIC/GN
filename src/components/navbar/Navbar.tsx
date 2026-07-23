import {
  BookOpen,
  Bug,
  Code2,
  Download,
  HelpCircle,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { useState } from "react";
import type { UserProfile } from "../../types/app";
import type { ModelId } from "../../types/semantic";
import { initials } from "../../utils/identity";
import { getModel } from "../../utils/semantic";
import { AskBrandMark } from "../common/Brand";
import { IconButton, IconTextButton } from "../ui/IconButton";

export function Navbar({
  user,
  modelId,
  sidebarOpen,
  profileOpen,
  setProfileOpen,
  debugOpen,
  toggleDebug,
  themeMode,
  toggleTheme,
  setSidebarOpen,
  openGuide,
  setTourOpen,
  setIssueOpen,
  setSettingsOpen,
  exportConversation,
  onSignOut,
  statusLabel,
}: {
  user: UserProfile;
  modelId?: ModelId;
  sidebarOpen: boolean;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  debugOpen: boolean;
  toggleDebug: () => void;
  themeMode: "light" | "dark";
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  openGuide: () => void;
  setTourOpen: (open: boolean) => void;
  setIssueOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  exportConversation: () => void;
  onSignOut: () => void;
  statusLabel: string;
}) {
  const [guideHovered, setGuideHovered] = useState(false);
  const activeModel = getModel(modelId ?? "metadata_stats_linear");

  return (
    <header className="topbar">
      <div className="topbar-left">
        <IconButton
          label="Toggle sidebar"
          className="mobile-menu"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu />
        </IconButton>
        <button
          className="brand-trigger"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          type="button"
          aria-label="Open conversation history"
        >
          <AskBrandMark />
        </button>
      </div>

      <div className="header-actions">
        <span className="system-status">
          <i />
          {statusLabel}
        </span>
        <div
          className="guide-button-wrap"
          onMouseEnter={() => setGuideHovered(true)}
          onMouseLeave={() => setGuideHovered(false)}
        >
          <IconButton
            label={`Guide for ${activeModel.name}`}
            className="model-guide-button"
            onClick={() => {
              setGuideHovered(!guideHovered);
              openGuide();
            }}
          >
            <HelpCircle />
          </IconButton>
          {guideHovered && (
            <div className="header-guide-popover">
              <div className="guide-popover-head">
                <span className="model-chip" style={{ backgroundColor: activeModel.color }}>
                  {activeModel.short}
                </span>
                <div>
                  <strong>{activeModel.name}</strong>
                  {activeModel.nickname && <small>{activeModel.nickname}</small>}
                </div>
              </div>
              <p className="guide-popover-desc">{activeModel.guide ?? activeModel.description}</p>
              <div className="guide-popover-prompts">
                <b>Try asking:</b>
                <ul>
                  {activeModel.prompts.map((prompt) => (
                    <li key={prompt}>{prompt}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
        <IconTextButton label="Tour" onClick={() => setTourOpen(true)}>
          <BookOpen />
        </IconTextButton>
        <IconTextButton label="Export" onClick={exportConversation}>
          <Download />
        </IconTextButton>
        <button
          className={`debug-toggle ${debugOpen ? "on" : ""}`}
          onClick={toggleDebug}
          aria-pressed={debugOpen}
          type="button"
        >
          <Code2 />
          <span>Debug {debugOpen ? "ON" : "OFF"}</span>
          <i />
        </button>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          type="button"
          aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
        >
          {themeMode === "dark" ? <Sun /> : <Moon />}
        </button>
        <div className="profile-wrap">
          <button
            className="avatar"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label="Open profile menu"
          >
            {initials(user.name)}
          </button>
          {profileOpen && (
            <div className="profile-menu">
              <b>{user.name}</b>
              <span>{user.email}</span>
              <small>{user.authProvider}</small>
              <button
                onClick={() => {
                  setIssueOpen(true);
                  setProfileOpen(false);
                }}
              >
                <Bug />
                Report errors
              </button>
              <button onClick={onSignOut}>
                <LogOut />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
