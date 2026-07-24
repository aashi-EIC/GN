import type { KeyboardEvent } from "react";

export function handleEnter(event: KeyboardEvent<HTMLTextAreaElement>, submit: () => void) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submit();
  }
}
