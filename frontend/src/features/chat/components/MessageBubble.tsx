import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { FeedbackValue, Message } from "../../../shared/types/app";
import { VisualizationRenderer } from "./charts/VisualizationRenderer";
import { IconButton } from "../../../shared/components/ui/IconButton";

function MessageBubbleComponent({
  message,
  debugOpen,
  feedback,
  copyMessage,
  markFeedback,
  onReportError,
  onEditUserMessage,
  onRegenerateResponse,
  busy = false,
}: {
  message: Message;
  debugOpen: boolean;
  feedback?: FeedbackValue;
  copyMessage: (message: Message) => void;
  markFeedback: (messageId: string, value: FeedbackValue) => void;
  onReportError: () => void;
  onEditUserMessage?: (messageId: string, newText: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
  busy?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!moreOpen) return undefined;

    const closeMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !moreMenuRef.current?.contains(target)) {
        setMoreOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [moreOpen]);

  const handleCopy = async () => {
    await copyMessage(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (message.role === "user") {
    if (isEditing) {
      return (
        <div className="user-row editing">
          <div className="user-edit-card">
            <textarea
              className="user-edit-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              rows={Math.max(2, editText.split("\n").length)}
            />
            <div className="user-edit-footer">
              <button
                type="button"
                className="user-edit-cancel"
                onClick={() => {
                  setIsEditing(false);
                  setEditText(message.text);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="user-edit-submit"
                disabled={!editText.trim() || editText.trim() === message.text}
                onClick={() => {
                  if (editText.trim() && onEditUserMessage) {
                    onEditUserMessage(message.id, editText.trim());
                    setIsEditing(false);
                  }
                }}
              >
                Save & Submit
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="user-row">
        <div className="user-bubble-container">
          <div className="user-bubble">{message.text}</div>
          <div className="user-message-actions response-actions">
            <IconButton label={copied ? "Copied" : "Copy message"} onClick={handleCopy}>
              {copied ? <Check /> : <Copy />}
            </IconButton>
            {onEditUserMessage && (
              <IconButton label="Edit message" onClick={() => setIsEditing(true)}>
                <Pencil />
              </IconButton>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isError =
    Boolean(message.debug?.some((d) => d.stage === "request_error")) ||
    Boolean(message.metrics?.some((m) => m.tone === "watch"));

  return (
    <div className="assistant-row">
      <div className="ai-mark">
        <Sparkles />
      </div>
      <article className={`response ${isError ? "response-error-state" : ""}`}>
        <SafeResponseText text={message.text} />

        {isError && onRegenerateResponse && (
          <div className="error-retry-row">
            <button
              type="button"
              className="btn-retry-action"
              onClick={() => onRegenerateResponse(message.id)}
              disabled={busy}
            >
              <RefreshCw className={busy ? "spin" : ""} size={15} />
              <span>{busy ? "Retrying analysis..." : "Retry Question"}</span>
            </button>
          </div>
        )}

        {message.metrics && (
          <div className="metric-grid">
            {message.metrics.map((metric) => (
              <div className={`metric ${metric.tone}`} key={metric.label}>
                <span>{metric.label}</span>
                <b>{metric.value}</b>
              </div>
            ))}
          </div>
        )}

        {message.visualizations && <VisualizationRenderer blocks={message.visualizations} />}

        <div className="response-actions">
          <IconButton
            label={feedback === "helpful" ? "Remove good response rating" : "Good response"}
            active={feedback === "helpful"}
            onClick={() => markFeedback(message.id, "helpful")}
          >
            <ThumbsUp />
          </IconButton>
          <IconButton
            label={feedback === "not-helpful" ? "Remove bad response rating" : "Bad response"}
            active={feedback === "not-helpful"}
            onClick={() => markFeedback(message.id, "not-helpful")}
          >
            <ThumbsDown />
          </IconButton>
          {onRegenerateResponse && (
            <IconButton
              label="Regenerate response"
              onClick={() => onRegenerateResponse(message.id)}
              disabled={busy}
            >
              <RefreshCw />
            </IconButton>
          )}
          <IconButton label={copied ? "Copied" : "Copy response"} onClick={handleCopy}>
            {copied ? <Check /> : <Copy />}
          </IconButton>
          <div className="response-more" ref={moreMenuRef}>
            <IconButton
              label="More options"
              active={moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
            >
              <MoreHorizontal />
            </IconButton>
            {moreOpen && (
              <div className="response-more-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    onReportError();
                  }}
                >
                  <AlertTriangle />
                  Report response
                </button>
              </div>
            )}
          </div>
        </div>

        {debugOpen && message.debug && (
          <div className="debug-panel">
            <div>
              <Code2 />
              <span>Admin debug mode</span>
              <b>node-bff</b>
            </div>
            <pre>
              {JSON.stringify(
                {
                  mcp_request_payload: message.mcpRequest,
                  debug_events: message.debug,
                },
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </article>
    </div>
  );
}

function SafeResponseText({ text }: { text: string }) {
  const renderedElements = useMemo(() => {
    if (!text) return null;

    // Split text by code blocks ```code```
    const blocks = text.split(/(```[\s\S]*?```)/g);

    return blocks.map((block, blockIdx) => {
      if (block.startsWith("```") && block.endsWith("```")) {
        const lines = block.slice(3, -3).trim().split("\n");
        const language = lines[0]?.match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : "";
        const codeContent = language ? lines.slice(1).join("\n") : lines.join("\n");

        return (
          <div key={`code-${blockIdx}`} className="markdown-code-block">
            <div className="code-block-header">
              <span>{language || "code"}</span>
              <button
                type="button"
                className="btn-copy-code"
                onClick={() => navigator.clipboard.writeText(codeContent)}
              >
                <Copy size={12} />
                <span>Copy</span>
              </button>
            </div>
            <pre>
              <code>{codeContent}</code>
            </pre>
          </div>
        );
      }

      // Process regular markdown lines (headers, lists, paragraphs)
      const lines = block.split("\n");
      const elements: React.ReactNode[] = [];
      let currentList: React.ReactNode[] = [];

      const flushList = (keyPrefix: string) => {
        if (currentList.length > 0) {
          elements.push(
            <ul key={`ul-${keyPrefix}-${elements.length}`} className="markdown-bullet-list">
              {currentList}
            </ul>,
          );
          currentList = [];
        }
      };

      lines.forEach((line, lineIdx) => {
        const trimmed = line.trim();

        // Bullet point lines (- item or * item or • item)
        if (/^[-*•]\s+/.test(trimmed)) {
          const listText = trimmed.replace(/^[-*•]\s+/, "");
          currentList.push(
            <li key={`li-${lineIdx}`}>{renderFormattedInlineText(listText)}</li>,
          );
          return;
        }

        // Flush list if we hit a non-list line
        flushList(`${blockIdx}-${lineIdx}`);

        if (!trimmed) {
          return;
        }

        // Headers (# H1, ## H2, ### H3)
        if (trimmed.startsWith("### ")) {
          elements.push(
            <h3 key={`h3-${lineIdx}`} className="markdown-h3">
              {renderFormattedInlineText(trimmed.slice(4))}
            </h3>,
          );
        } else if (trimmed.startsWith("## ")) {
          elements.push(
            <h2 key={`h2-${lineIdx}`} className="markdown-h2">
              {renderFormattedInlineText(trimmed.slice(3))}
            </h2>,
          );
        } else if (trimmed.startsWith("# ")) {
          elements.push(
            <h1 key={`h1-${lineIdx}`} className="markdown-h1">
              {renderFormattedInlineText(trimmed.slice(2))}
            </h1>,
          );
        } else {
          elements.push(
            <p key={`p-${lineIdx}`} className="markdown-p">
              {renderFormattedInlineText(line)}
            </p>,
          );
        }
      });

      flushList(`${blockIdx}-end`);
      return <div key={`block-${blockIdx}`}>{elements}</div>;
    });
  }, [text]);

  return <div className="markdown-response-body">{renderedElements}</div>;
}

function renderFormattedInlineText(text: string): React.ReactNode {
  // Regex to match **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={idx} className="markdown-inline-code">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export const MessageBubble = memo(MessageBubbleComponent);
