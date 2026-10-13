import { ArrowUpRight, Menu, MoonStar, Sun } from "lucide-react";
import type { ModelId } from "../../features/chat/types/semantic";
import { getModel } from "../../features/chat/utils/semantic";
import { IconButton } from "./ui/IconButton";

function WalkthroughCompassMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" focusable="false">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.35" opacity="0.65" />
      <path d="m15.8 8.2-2.2 5.4-3.2-3.2 5.4-2.2Z" fill="currentColor" />
      <path d="m8.2 15.8 2.2-5.4 3.2 3.2-5.4 2.2Z" fill="currentColor" opacity="0.4" />
      <circle cx="12" cy="12" r="0.85" fill="currentColor" />
    </svg>
  );
}

function GuideBookMark() {
  return (
    <svg
      className="guide-book-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="guide-book-page"
        d="M12 19.7c-2.7-1.6-5.5-2-8.4-1.4V5.2c2.9-.6 5.7-.15 8.4 1.48V19.7Z"
      />
      <path
        className="guide-book-page"
        d="M12 19.7c2.7-1.6 5.5-2 8.4-1.4V5.2c-2.9-.6-5.7-.15-8.4 1.48V19.7Z"
      />
      <path
        className="guide-book-lines"
        d="M6.6 9.1c1-.03 1.95.15 2.86.52M6.6 11.8c1-.03 1.95.15 2.86.52"
      />
      <path
        className="guide-book-spark"
        d="m17.1 8 .62 1.79 1.79.62-1.79.62-.62 1.79-.62-1.79-1.79-.62 1.79-.62L17.1 8Z"
      />
      <path
        className="guide-book-base"
        d="M4.4 20.2c2.7-.4 5.3.16 7.6 1.47 2.3-1.31 4.9-1.87 7.6-1.47"
      />
    </svg>
  );
}

export function Navbar({
  modelId,
  openGuide,
  showWalkthroughBanner,
  openWalkthrough,
  themeMode,
  toggleTheme,
  sidebarOpen = false,
  toggleSidebar,
}: {
  modelId?: ModelId;
  openGuide: () => void;
  showWalkthroughBanner: boolean;
  openWalkthrough: () => void;
  themeMode: "light" | "dark";
  toggleTheme: () => void;
  conversationTitle?: string;
  sidebarOpen?: boolean;
  toggleSidebar?: () => void;
  onSelectPrompt?: (prompt: string) => void;
}) {
  const activeModel = getModel(modelId ?? "schedule_completeness_tsg");

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="mobile-menu"
          type="button"
          aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={sidebarOpen}
          onClick={toggleSidebar}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="header-actions">
        {showWalkthroughBanner ? (
          <button
            className="walkthrough-banner"
            type="button"
            onClick={openWalkthrough}
            aria-label="Start the Conversational BI walkthrough"
          >
            <span className="walkthrough-banner-mark" aria-hidden="true">
              <WalkthroughCompassMark />
            </span>
            <span className="walkthrough-banner-copy">
              <span className="walkthrough-banner-eyebrow">Guided tour</span>
              <span>Explore the workspace</span>
            </span>
            <span className="walkthrough-banner-action" aria-hidden="true">
              <ArrowUpRight className="walkthrough-banner-arrow" />
            </span>
          </button>
        ) : null}
        <IconButton
          label={`Switch to ${themeMode === "dark" ? "light" : "dark"} theme`}
          className="theme-toggle"
          onClick={toggleTheme}
          active={themeMode === "dark"}
        >
          {themeMode === "dark" ? <Sun /> : <MoonStar />}
        </IconButton>
        <div className="guide-button-wrap">
          <IconButton
            label={`Prompts & Guide for ${activeModel.name}`}
            className="model-guide-button"
            onClick={openGuide}
          >
            <GuideBookMark />
          </IconButton>
          <span className="model-guide-tooltip" aria-hidden="true">
            Model guide
          </span>
        </div>
      </div>
    </header>
  );
}
