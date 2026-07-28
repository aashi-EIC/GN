import type { Message } from "../types/app";

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function messageToPlainText(message: Message) {
  const sections = [message.text];
  if (message.metrics?.length) {
    sections.push(message.metrics.map((metric) => `${metric.label}: ${metric.value}`).join("\n"));
  }
  if (message.actions?.length) {
    sections.push(message.actions.map((action) => `Action: ${action}`).join("\n"));
  }
  return sections.join("\n\n");
}

export function downloadJson(filename: string, payload: unknown) {
  downloadText(filename, JSON.stringify(payload, null, 2), "application/json");
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}
