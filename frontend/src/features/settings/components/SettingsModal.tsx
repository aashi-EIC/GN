import { Braces, CircleGauge, MoonStar, UserRound, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SettingsState } from "../../../shared/types/app";
import { TokenUsageBar } from "../../chat/components/TokenUsageBar";
import { useMonthlyTokenQuota } from "../hooks/useMonthlyTokenQuota";

export function SettingsModal({
  close,
  settings,
  saveSettings,
  toggleDebug,
  settingsSaveError,
  themeMode,
  toggleTheme,
}: {
  close: () => void;
  settings: SettingsState;
  saveSettings: (settings: SettingsState) => void;
  toggleDebug?: () => void;
  settingsSaveError?: string | null;
  themeMode: "light" | "dark";
  toggleTheme: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const { quota, error: quotaError, loading: quotaLoading } = useMonthlyTokenQuota();

  useEffect(() => {
    const trigger = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (trigger instanceof HTMLElement && document.activeElement === document.body) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".sidebar-settings-btn")) {
        return;
      }
      if (!panelRef.current?.contains(event.target as Node)) close();
    };

    const scrollChat = (event: WheelEvent) => {
      const panel = panelRef.current;
      const target = event.target as Node;

      // Outside the panel, keep native chat and sidebar scrolling (and zoom).
      if (!panel?.contains(target) || event.ctrlKey || !event.deltaY) return;

      if (panel?.contains(target)) {
        const atTop = panel.scrollTop <= 0;
        const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
        const panelCanScroll = (event.deltaY < 0 && !atTop) || (event.deltaY > 0 && !atBottom);

        if (panelCanScroll) return;
      }

      const messages = document.querySelector<HTMLElement>(".chat > .messages");
      if (!messages) return;

      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? messages.clientHeight : 1;
      messages.scrollTop += event.deltaY * unit;
      event.preventDefault();
    };

    document.addEventListener("keydown", closeOnEscape, true);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("wheel", scrollChat, { capture: true, passive: false });

    return () => {
      document.removeEventListener("keydown", closeOnEscape, true);
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
        <div className="settings-panel-heading">
          <span>Settings</span>
          <button type="button" aria-label="Close settings" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-settings-form">
          <label className="sidebar-settings-row">
            <UserRound />
            <span>Display name</span>
            <input
              value={settings.displayName}
              onChange={(event) => updateDisplayName(event.target.value)}
              aria-label="Display name"
              maxLength={120}
              autoComplete="nickname"
            />
          </label>
          {settingsSaveError && (
            <p className="settings-save-status" role="alert">
              {settingsSaveError}
            </p>
          )}

          <div className="sidebar-settings-usage">
            <div className="usage-title">
              <CircleGauge />
              <span>Token usage</span>
            </div>
            {quota ? (
              <TokenUsageBar
                usage={quota.usage}
                limit={quota.limit}
                label={quota.unconfirmed ? "Confirmed monthly usage" : "Monthly token usage"}
              />
            ) : (
              <p className="token-usage-description" role={quotaError ? "alert" : "status"}>
                {quotaLoading
                  ? "Loading monthly usage…"
                  : "Monthly usage is unavailable. Reopen Settings to retry."}
              </p>
            )}
            {quota?.pending ? (
              <p className="token-usage-description" role="status">
                {quota.pending} request(s) awaiting final usage.
              </p>
            ) : null}
            {quota?.unconfirmed ? (
              <p className="token-usage-description" role="status">
                Some requests did not report token usage. This balance may be incomplete; you can
                continue chatting.
              </p>
            ) : null}
            {quota && quota.remaining === 0 ? (
              <p className="token-usage-description" role="status">
                Monthly limit reached. New requests resume next month.
              </p>
            ) : null}
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
          <button
            type="button"
            className={`sidebar-settings-row ${themeMode === "dark" ? "active" : ""}`}
            onClick={toggleTheme}
            aria-pressed={themeMode === "dark"}
          >
            <MoonStar />
            <span>Dark theme</span>
            <span
              className={`settings-switch ${themeMode === "dark" ? "active" : ""}`}
              aria-hidden="true"
            >
              <span className="settings-switch-thumb" />
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
}
