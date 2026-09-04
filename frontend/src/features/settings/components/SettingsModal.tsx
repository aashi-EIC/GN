import { Braces, CircleGauge, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SettingsState } from "../../../shared/types/app";

export function SettingsModal({
  close,
  settings,
  saveSettings,
  toggleDebug,
}: {
  close: () => void;
  settings: SettingsState;
  saveSettings: (settings: SettingsState) => void;
  toggleDebug?: () => void;
  themeMode?: "light" | "dark";
  toggleTheme?: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) close();
    };

    const scrollChat = (event: WheelEvent) => {
      const panel = panelRef.current;
      const target = event.target as Node;

      if (panel?.contains(target)) {
        const atTop = panel.scrollTop <= 0;
        const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
        const panelCanScroll = (event.deltaY < 0 && !atTop) || (event.deltaY > 0 && !atBottom);

        if (panelCanScroll) return;
      }

      const messages = document.querySelector<HTMLElement>(".chat > .messages");
      if (!messages) return;

      messages.scrollTop += event.deltaY;
      event.preventDefault();
    };

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("wheel", scrollChat, { capture: true, passive: false });

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("wheel", scrollChat, { capture: true });
    };
  }, [close]);

  const updateDisplayName = (name: string) => {
    saveSettings({ ...settings, displayName: name });
  };

  return (
    <div className="settings-sidebar-backdrop">
      <aside
        ref={panelRef}
        className="sidebar-settings-panel"
        role="dialog"
        aria-modal="false"
        aria-label="Workspace settings"
        tabIndex={-1}
      >
        <div className="sidebar-settings-form">
          <label className="sidebar-settings-row">
            <UserRound />
            <span>Display name</span>
            <input
              value={settings.displayName}
              onChange={(event) => updateDisplayName(event.target.value)}
              aria-label="Display name"
            />
          </label>

          <div className="sidebar-settings-usage">
            <div className="usage-title">
              <CircleGauge />
              <span>Token usage</span>
            </div>
            <div>
              <span>Input tokens</span>
              <strong>-</strong>
            </div>
          </div>

          {toggleDebug && (
            <button
              type="button"
              className={`sidebar-settings-row ${settings.keepDebugOpen ? "active" : ""}`}
              onClick={toggleDebug}
              aria-pressed={settings.keepDebugOpen}
            >
              <Braces />
              <span>
                Debug responses
                <small>Show raw MCP and processed BFF payloads</small>
              </span>
              <span
                className={`settings-switch ${settings.keepDebugOpen ? "active" : ""}`}
                aria-hidden="true"
              >
                <span className="settings-switch-thumb" />
              </span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
