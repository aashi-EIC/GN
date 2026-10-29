import { useEffect, type RefObject } from "react";

const keyboardControl = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="button"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="spinbutton"]',
].join(",");

const openInteraction = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="listbox"]',
  '[role="menu"]',
  ".model-menu",
  ".profile-menu",
  ".response-more-menu",
  ".user-edit-card",
].join(",");

export function useComposerTypeFocus(
  inputRef: RefObject<HTMLTextAreaElement | null>,
  disabled: boolean,
) {
  useEffect(() => {
    if (disabled) return;

    const focusForTyping = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        ((event.ctrlKey || event.altKey) && !event.getModifierState("AltGraph"))
      )
        return;

      const startsComposition = event.key === "Dead" || event.key === "Process";
      if (!startsComposition && (Array.from(event.key).length !== 1 || !event.key.trim())) return;

      const input = inputRef.current;
      if (
        !input ||
        input.disabled ||
        input.readOnly ||
        !input.getClientRects().length ||
        input.closest('[inert], [hidden], [aria-hidden="true"]')
      )
        return;

      for (const target of [...event.composedPath(), document.activeElement]) {
        if (target instanceof Element && target.closest(keyboardControl)) return;
      }
      if (document.querySelector(openInteraction)) return;

      // Let the browser insert text normally, preserving the first character and undo history.
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    };

    document.addEventListener("keydown", focusForTyping);
    return () => document.removeEventListener("keydown", focusForTyping);
  }, [disabled, inputRef]);
}
