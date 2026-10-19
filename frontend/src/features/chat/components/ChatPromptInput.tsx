import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { handleEnter } from "../../../shared/utils/keyboard";
import { MagicCommandHint } from "./MagicCommandHint";

const SLASH_COMMANDS = [
  { name: "/help", description: "Open the guided walkthrough", available: true },
  { name: "/new", description: "Start a new conversation", available: true },
  { name: "/settings", description: "Open workspace settings", available: true },
  { name: "/metrics", description: "", available: false },
  { name: "/glossary", description: "", available: false },
] as const;

type SlashCommand = (typeof SLASH_COMMANDS)[number];

const MAGIC_COMMAND_ANIMATION_ENABLED = false;

function slashQuery(value: string): string | null {
  return /^\/([^\s]*)$/.exec(value.trimStart())?.[1].toLowerCase() ?? null;
}

export function ChatPromptInput({
  prompt,
  setPrompt,
  submitPrompt,
  label,
  showMagicHint,
  dismissMagicHint,
  disabled = false,
}: {
  prompt: string;
  setPrompt: (prompt: string) => void;
  submitPrompt: () => void;
  label: string;
  showMagicHint: boolean;
  dismissMagicHint: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuId = useId();
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = slashQuery(prompt);
  const visibleCommands =
    query === null
      ? []
      : SLASH_COMMANDS.filter((command) => command.name.slice(1).startsWith(query));
  const selectableCommands = visibleCommands.filter((command) => command.available);
  const menuVisible = !disabled && slashMenuOpen && query !== null;
  const selectedIndex = Math.min(activeIndex, Math.max(selectableCommands.length - 1, 0));
  const selectedCommand = selectableCommands[selectedIndex];

  const selectCommand = (command: SlashCommand) => {
    if (disabled || !command.available) return;
    setPrompt(command.name + " ");
    setSlashMenuOpen(false);
    dismissMagicHint();
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled || event.nativeEvent.isComposing) return;

    if (menuVisible) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (selectableCommands.length > 0) {
          setActiveIndex(
            (current) =>
              (current + (event.key === "ArrowDown" ? 1 : -1) + selectableCommands.length) %
              selectableCommands.length,
          );
        }
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        if (selectedCommand) {
          event.preventDefault();
          selectCommand(selectedCommand);
          return;
        }
        event.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }

    handleEnter(event, () => submitPrompt());
  };

  return (
    <>
      <textarea
        ref={inputRef}
        rows={1}
        value={prompt}
        disabled={disabled}
        onChange={(event) => {
          const nextPrompt = event.target.value;
          setPrompt(nextPrompt);
          dismissMagicHint();
          setSlashMenuOpen(slashQuery(nextPrompt) !== null);
          setActiveIndex(0);
        }}
        onFocus={() => {
          dismissMagicHint();
          setSlashMenuOpen(slashQuery(prompt) !== null);
        }}
        onBlur={() => setSlashMenuOpen(false)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-label={label}
        aria-description={
          disabled
            ? "Wait for the current response to finish"
            : "Ask a question or type / to see commands"
        }
        aria-autocomplete="list"
        aria-expanded={menuVisible}
        aria-controls={menuVisible ? menuId : undefined}
        aria-activedescendant={
          menuVisible && selectedCommand ? menuId + "-" + selectedCommand.name.slice(1) : undefined
        }
        placeholder={disabled ? "Generating response..." : ""}
      />
      {MAGIC_COMMAND_ANIMATION_ENABLED && !disabled && showMagicHint && prompt.length === 0 && (
        <MagicCommandHint />
      )}
      {menuVisible && (
        <div className="slash-command-menu">
          <div className="slash-command-menu-heading">Commands</div>
          <div
            className="slash-command-options"
            id={menuId}
            role="listbox"
            aria-label="Slash commands"
          >
            {visibleCommands.length > 0 ? (
              visibleCommands.map((command) => (
                <button
                  key={command.name}
                  id={menuId + "-" + command.name.slice(1)}
                  className={
                    "slash-command-option " +
                    (command.name === selectedCommand?.name ? "is-selected" : "")
                  }
                  type="button"
                  role="option"
                  aria-selected={command.name === selectedCommand?.name}
                  aria-disabled={!command.available}
                  disabled={!command.available}
                  tabIndex={-1}
                  onPointerDown={(event) => {
                    if (!command.available) return;
                    event.preventDefault();
                    selectCommand(command);
                  }}
                  onMouseEnter={() => {
                    if (command.available) {
                      setActiveIndex(
                        selectableCommands.findIndex((item) => item.name === command.name),
                      );
                    }
                  }}
                  onClick={(event) => {
                    if (event.detail === 0) selectCommand(command);
                  }}
                >
                  <span className="slash-command-name">{command.name}</span>
                  {command.description && (
                    <span className="slash-command-description">{command.description}</span>
                  )}
                </button>
              ))
            ) : (
              <div className="slash-command-empty">No matching commands</div>
            )}
          </div>
          <div className="slash-command-menu-footer">
            Up/Down to navigate, Enter to insert, Esc to close
          </div>
        </div>
      )}
    </>
  );
}
