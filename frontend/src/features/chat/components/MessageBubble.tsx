import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  Sparkles,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type {
  FeedbackValue,
  Message,
  TablePageSize,
  VisualizationBlock,
} from "../../../shared/types/app";
import { IconButton } from "../../../shared/components/ui/IconButton";
import { AssistantMark } from "../../../shared/components/AssistantMark";
import { StructuredTable } from "./charts/VisualizationRenderer";
import { normalizeDataLists } from "../utils/responseTables";
import { removeChartScriptSections, streamingDisplayText } from "../utils/responseDisplay";
import { DebugDrawer } from "../../debug/components/DebugDrawer";
import { renderInlineVisualMarkers } from "./InlineVisualMarkers";
import { handleEnter } from "../../../shared/utils/keyboard";
import type { StreamProgressStore } from "../services/streamProgress";
import { ThinkingAnimation } from "./ThinkingAnimation";
import "./messageBubbleMarkdown.css";
import "./responseRegeneration.css";

function MessageBubbleComponent({
  message,
  tablePageSize,
  debugOpen,
  feedback,
  copyMessage,
  markFeedback,
  onReportError,
  onEditUserMessage,
  onRegenerateResponse,
  busy = false,
  regenerating = false,
  streamProgress,
  conversationId,
  userPrompt,
}: {
  message: Message;
  tablePageSize: TablePageSize;
  debugOpen: boolean;
  feedback?: FeedbackValue;
  copyMessage: (message: Message) => void;
  markFeedback: (messageId: string, value: FeedbackValue) => void;
  onReportError: () => void;
  onEditUserMessage?: (messageId: string, newText: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
  busy?: boolean;
  regenerating?: boolean;
  streamProgress: StreamProgressStore;
  conversationId: string;
  userPrompt?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [debugDrawerOpen, setDebugDrawerOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

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
              disabled={busy}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setIsEditing(false);
                  setEditText(message.text);
                  return;
                }
                handleEnter(e, () => {
                  if (!busy && editText.trim() && onEditUserMessage) {
                    if (editText.trim() !== message.text) {
                      onEditUserMessage(message.id, editText.trim());
                    }
                    setIsEditing(false);
                  }
                });
              }}
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
                disabled={busy || !editText.trim() || editText.trim() === message.text}
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
              <IconButton label="Edit message" disabled={busy} onClick={() => setIsEditing(true)}>
                <Pencil />
              </IconButton>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isError = Boolean(message.debug?.some((event) => event.stage === "request_error"));
  const suggestionMarker = "💡 **Suggested Action**:";
  const [errorSummary, errorSuggestion = ""] = message.text.split(suggestionMarker);
  const errorStatus =
    message.metrics?.find((metric) => metric.tone === "watch")?.value || "Request failed";
  const hasDebugData = Boolean(
    (message.debug && message.debug.length > 0) || message.mcpRequest,
  );
  const debugTrigger =
    hasDebugData && debugOpen !== false ? (
      <button
        type="button"
        className="debug-details-trigger"
        aria-haspopup="dialog"
        onClick={() => setDebugDrawerOpen(true)}
      >
        <span className={`debug-status-dot ${isError ? "warning" : ""}`} aria-hidden="true" />
        Debug details
      </button>
    ) : null;

  return (
    <div
      className={`assistant-row ${regenerating ? "regenerating-row" : ""}`}
      data-message-id={message.id}
    >
      <AssistantMark />
      <motion.article
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`response ${isError ? "response-error-state" : ""} ${regenerating ? "is-regenerating" : ""}`}
        aria-busy={regenerating}
      >
        {regenerating && (
          <div className="regeneration-preview">
            <PendingResponse
              progress={streamProgress}
              conversationId={conversationId}
              tablePageSize={tablePageSize}
              userPrompt={userPrompt}
            />
          </div>
        )}
        <div
          className="response-content"
          aria-hidden={regenerating || undefined}
          inert={regenerating || undefined}
        >
          {!regenerating && (
            <InterruptedResponse
              progress={streamProgress}
              messageId={message.id}
              tablePageSize={tablePageSize}
            />
          )}
          {isError ? (
            <div className="error-compact-card" role="alert">
              <div className="error-compact-icon" aria-hidden="true">
                <AlertTriangle />
              </div>
              <div className="error-compact-copy">
                <span className="error-compact-status">{errorStatus}</span>
                <p>{errorSummary.trim()}</p>
                {errorSuggestion.trim() && <small>{errorSuggestion.trim()}</small>}
              </div>
              {onRegenerateResponse && (
                <button
                  type="button"
                  className="btn-retry-action"
                  onClick={() => onRegenerateResponse(message.id)}
                  disabled={busy}
                >
                  <RefreshCw className={regenerating ? "regeneration-spinner" : ""} size={14} />
                  <span>{regenerating ? "Retrying..." : "Try again"}</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <SafeResponseText text={message.text} tablePageSize={tablePageSize} />

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
                    label={regenerating ? "Regenerating response" : "Regenerate response"}
                    className={regenerating ? "regenerating" : ""}
                    onClick={() => onRegenerateResponse(message.id)}
                    disabled={busy}
                  >
                    <RefreshCw className={regenerating ? "regeneration-spinner" : ""} />
                  </IconButton>
                )}
                <IconButton label={copied ? "Copied" : "Copy response"} onClick={handleCopy}>
                  {copied ? <Check /> : <Copy />}
                </IconButton>
                <div className={`response-more ${moreOpen ? "open" : ""}`} ref={moreMenuRef}>
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
                {debugTrigger}
              </div>
            </>
          )}

          {isError && debugTrigger}
          {hasDebugData && debugOpen !== false && (
            <DebugDrawer
              message={message}
              open={debugDrawerOpen}
              onClose={() => setDebugDrawerOpen(false)}
            />
          )}
        </div>
      </motion.article>
    </div>
  );
}

const insightPrefixPattern =
  /^\s*>?\s*(?:#{1,6}\s*)?(?:(?:[-\u2022]|\*(?!\*))\s+)?(?:(?:\*\*|__)\s*)?(?:\p{Extended_Pictographic}\uFE0F?\s*)*(?:(?:\*\*|__)\s*)?(?:(?:key\s+)?findings?\s*(?:\/|&|and)\s*insights?|(?:key\s+)?insights?)\s*:?\s*(?:(?:\*\*|__)\s*)*/iu;

function hasInsightPrefix(value: string) {
  return insightPrefixPattern.test(value);
}

function stripInsightPrefix(value: string) {
  if (hasInsightPrefix(value)) {
    return value.replace(insightPrefixPattern, "").trim();
  }

  return value.replace(/^\s*>\s*/, "").trim();
}

export function PendingResponse({
  progress,
  conversationId,
  tablePageSize,
  userPrompt,
}: {
  progress: StreamProgressStore;
  conversationId: string;
  tablePageSize: TablePageSize;
  userPrompt?: string;
}) {
  const subscribe = useCallback(
    (listener: () => void) => progress.subscribe(conversationId, listener),
    [progress, conversationId],
  );
  const getSnapshot = useCallback(
    () => progress.getSnapshot(conversationId),
    [progress, conversationId],
  );
  const { text } = useSyncExternalStore(subscribe, getSnapshot);
  const preview = useMemo(() => streamingDisplayText(text), [text]);
  return (
    <div className={`pending-response ${preview ? "has-preview" : ""}`} aria-busy="true">
      {preview && <SafeResponseText text={preview} tablePageSize={tablePageSize} streaming />}
      <ThinkingAnimation preview={Boolean(preview)} prompt={userPrompt} />
    </div>
  );
}

function InterruptedResponse({
  progress,
  messageId,
  tablePageSize,
}: {
  progress: StreamProgressStore;
  messageId: string;
  tablePageSize: TablePageSize;
}) {
  const subscribe = useCallback(
    (listener: () => void) => progress.subscribe(messageId, listener),
    [progress, messageId],
  );
  const getSnapshot = useCallback(() => progress.getSnapshot(messageId), [progress, messageId]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const preview = useMemo(() => streamingDisplayText(snapshot.text), [snapshot.text]);
  if (!snapshot.interrupted) return null;
  return (
    <div className="interrupted-response">
      <div className="stream-interrupted-notice" role="status">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>{snapshot.status}</span>
      </div>
      {!snapshot.restored && preview && (
        <SafeResponseText text={preview} tablePageSize={tablePageSize} partial />
      )}
    </div>
  );
}

function SafeResponseText({
  text,
  tablePageSize,
  streaming = false,
  partial = false,
}: {
  text: string;
  tablePageSize: TablePageSize;
  streaming?: boolean;
  partial?: boolean;
}) {
  const renderedElements = useMemo(() => {
    if (!text) return null;

    const visibleText = normalizeDataLists(removeChartScriptSections(text));

    const blocks = visibleText.split(/(```[\s\S]*?```)/g);

    return blocks.map((block, blockIdx) => {
      if (block.startsWith("```") && block.endsWith("```")) {
        const lines = block.slice(3, -3).trim().split("\n");
        const language = lines[0]?.match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : "";
        const codeContent = language ? lines.slice(1).join("\n") : lines.join("\n");

        // Empty transport payloads are not answer content.
        if (isEmptyStructuredPayload(codeContent, language)) {
          return null;
        }

        if (/^(?:chartType|chart_type|chart)\s*:/i.test(codeContent.trim())) {
          return null;
        }

        const tableBlock = tableFromCodeBlock(codeContent);

        if (tableBlock) {
          return (
            <ResponseTable
              key={`table-code-${blockIdx}`}
              source={codeContent}
              receiving={streaming}
              partial={partial}
              block={tableBlock}
              defaultPageSize={tablePageSize}
            />
          );
        }

        return (
          <div key={`code-${blockIdx}`} className="markdown-code-block">
            <div className="code-block-header">
              <span>{language || "code"}</span>
              <button
                type="button"
                className="btn-copy-code"
                disabled={streaming || partial}
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

      const lines = block.split("\n");
      const elements: React.ReactNode[] = [];
      let currentList: React.ReactNode[] = [];
      let currentKpiList: Array<{ label: string; value: string; subtext?: string }> = [];
      let currentInsight: string[] = [];
      let collectingInsight = false;
      let currentBlockquote: string[] = [];

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

      const flushKpiList = (keyPrefix: string) => {
        if (currentKpiList.length > 0) {
          elements.push(
            <div key={`kpi-${keyPrefix}-${elements.length}`} className="kpi-card-grid">
              {currentKpiList.map((kpi, idx) => (
                <div key={`kpi-item-${idx}`} className="kpi-card">
                  <div className="kpi-card-header">
                    <span className="kpi-label">{kpi.label}</span>
                  </div>
                  <b className="kpi-value">{kpi.value}</b>
                  {kpi.subtext && <span className="kpi-subtext">{kpi.subtext}</span>}
                </div>
              ))}
            </div>,
          );
          currentKpiList = [];
        }
      };

      const flushInsight = (keyPrefix: string) => {
        if (collectingInsight) {
          elements.push(<InsightHeader key={`insight-${keyPrefix}-${elements.length}`} />);
          currentInsight.forEach((bqLine, idx) => {
            elements.push(
              <p key={`insight-p-${keyPrefix}-${idx}`} className="insight-body-text">
                {renderFormattedInlineText(bqLine)}
              </p>,
            );
          });
          currentInsight = [];
          collectingInsight = false;
        }
      };

      const flushBlockquote = (keyPrefix: string) => {
        if (currentBlockquote.length > 0) {
          elements.push(
            <blockquote key={`bq-${keyPrefix}-${elements.length}`} className="markdown-blockquote">
              <span className="markdown-note-icon" aria-hidden="true">
                <Info size={14} />
              </span>
              <div className="markdown-note-content">
                <span className="markdown-note-label">Note</span>
                {currentBlockquote.map((bqLine, idx) => (
                  <p key={idx}>{renderNoteContent(bqLine)}</p>
                ))}
              </div>
            </blockquote>,
          );
          currentBlockquote = [];
        }
      };

      let skipThroughLine = -1;

      lines.forEach((line, lineIdx) => {
        if (lineIdx <= skipThroughLine) return;

        const trimmed = line.trim();

        if (
          isMarkdownTableRow(trimmed) &&
          lineIdx + 1 < lines.length &&
          isMarkdownTableSeparator(lines[lineIdx + 1], parseMarkdownTableRow(trimmed).length)
        ) {
          flushList(`${blockIdx}-${lineIdx}`);
          flushKpiList(`${blockIdx}-${lineIdx}`);
          flushInsight(`${blockIdx}-${lineIdx}`);
          flushBlockquote(`${blockIdx}-${lineIdx}`);

          const headers = parseMarkdownTableRow(trimmed);
          const rows: string[][] = [];
          let nextLine = lineIdx + 2;

          while (nextLine < lines.length && isMarkdownTableRow(lines[nextLine])) {
            rows.push(parseMarkdownTableRow(lines[nextLine]));
            nextLine += 1;
          }
          skipThroughLine = nextLine - 1;

          const tableBlock: Extract<VisualizationBlock, { type: "table" }> = {
            type: "table",
            title: "Data Table",
            columns: headers.map((header, index) => ({
              key: `col_${index}`,
              label: header,
            })),
            rows: rows,
          };

          elements.push(
            <div key={`table-${blockIdx}-${lineIdx}`}>
              <ResponseTable
                source={lines.slice(lineIdx, nextLine).join("\n")}
                receiving={streaming}
                partial={partial}
                block={tableBlock}
                minimal={true}
                defaultPageSize={tablePageSize}
              />
            </div>,
          );
          return;
        }

        const metricMatch = trimmed.match(
          /^[-*•]\s+(?:\*\*([^*]+)\*\*|([A-Za-z0-9\s_%–-]+)):\s*([^(]+?)(?:\s*\(([^)]+)\))?$/,
        );
        if (metricMatch && !collectingInsight) {
          flushList(`${blockIdx}-${lineIdx}`);
          flushBlockquote(`${blockIdx}-${lineIdx}`);
          const label = metricMatch[1] || metricMatch[2];
          const value = metricMatch[3];
          const subtext = metricMatch[4];

          currentKpiList.push({
            label: label.trim(),
            value: value.trim(),
            subtext: subtext?.trim(),
          });
          return;
        }

        if (hasInsightPrefix(trimmed)) {
          flushList(`${blockIdx}-${lineIdx}`);
          flushKpiList(`${blockIdx}-${lineIdx}`);
          flushBlockquote(`${blockIdx}-${lineIdx}`);
          collectingInsight = true;
          const insightText = stripInsightPrefix(trimmed);
          if (insightText) currentInsight.push(insightText);
          return;
        }

        if (/^[-*•]\s+/.test(trimmed)) {
          flushKpiList(`${blockIdx}-${lineIdx}`);
          flushBlockquote(`${blockIdx}-${lineIdx}`);
          const listText = trimmed.replace(/^[-*•]\s+/, "");
          if (collectingInsight) {
            currentInsight.push(`• ${listText}`);
            return;
          }
          currentList.push(<li key={`li-${lineIdx}`}>{renderFormattedInlineText(listText)}</li>);
          return;
        }

        if (trimmed.startsWith(">")) {
          flushList(`${blockIdx}-${lineIdx}`);
          flushKpiList(`${blockIdx}-${lineIdx}`);
          const bqText = trimmed.replace(/^\s*>\s*/, "").trim();

          if (bqText) {
            if (collectingInsight) {
              currentInsight.push(bqText);
            } else {
              currentBlockquote.push(bqText);
            }
          }
          return;
        }

        if (!trimmed) {
          flushList(`${blockIdx}-${lineIdx}`);
          flushKpiList(`${blockIdx}-${lineIdx}`);
          flushBlockquote(`${blockIdx}-${lineIdx}`);
          return;
        }

        flushList(`${blockIdx}-${lineIdx}`);
        flushKpiList(`${blockIdx}-${lineIdx}`);
        flushInsight(`${blockIdx}-${lineIdx}`);
        flushBlockquote(`${blockIdx}-${lineIdx}`);

        if (/^_{3,}$|^-{3,}$|^\*{3,}$/.test(trimmed)) {
          elements.push(<hr key={`hr-${lineIdx}`} className="markdown-divider" />);
          return;
        }

        if (/^[^a-z0-9]*findings\s*\/\s*insights\s*:/i.test(trimmed)) {
          elements.push(<InsightHeader key={`insight-${lineIdx}`} />);
          return;
        }

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
      flushKpiList(`${blockIdx}-end`);
      flushInsight(`${blockIdx}-end`);
      flushBlockquote(`${blockIdx}-end`);
      return <div key={`block-${blockIdx}`}>{elements}</div>;
    });
  }, [tablePageSize, text, streaming, partial]);

  return (
    <div className={`markdown-response-body ${streaming ? "streaming-markdown" : ""}`}>
      {renderedElements}
    </div>
  );
}

const ResponseTable = memo(
  function ResponseTable({
    block,
    minimal,
    defaultPageSize,
    receiving,
    partial,
  }: {
    source: string;
    block: Extract<VisualizationBlock, { type: "table" }>;
    minimal?: boolean;
    defaultPageSize: TablePageSize;
    receiving: boolean;
    partial?: boolean;
  }) {
    return (
      <StructuredTable
        block={block}
        minimal={minimal}
        defaultPageSize={defaultPageSize}
        receiving={receiving}
        partial={partial}
      />
    );
  },
  (previous, next) =>
    previous.source === next.source &&
    previous.minimal === next.minimal &&
    previous.receiving === next.receiving &&
    previous.partial === next.partial &&
    previous.defaultPageSize === next.defaultPageSize,
);

function InsightHeader() {
  return (
    <div className="executive-insight-block insight-pill">
      <div className="executive-insight-header">
        <Sparkles size={14} className="executive-insight-sparkle" aria-hidden="true" />
        <span>Findings &amp; Insights</span>
      </div>
    </div>
  );
}

function isEmptyStructuredPayload(content: string, language: string) {
  const trimmed = content.trim();
  if (!trimmed) return true;

  const normalizedLanguage = language.trim().toLowerCase();
  const isJson =
    normalizedLanguage === "json" ||
    normalizedLanguage === "jsonc" ||
    (!normalizedLanguage && (trimmed.startsWith("[") || trimmed.startsWith("{")));
  if (!isJson) return false;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null) return true;
    if (Array.isArray(parsed)) return parsed.length === 0;
    return typeof parsed === "object" && Object.keys(parsed).length === 0;
  } catch {
    return false;
  }
}

function isMarkdownTableRow(line: string) {
  return parseMarkdownTableRow(line).length >= 2;
}

function isMarkdownTableSeparator(line: string, columnCount: number) {
  const cells = parseMarkdownTableRow(line);
  return cells.length === columnCount && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdownTableRow(line: string) {
  const source = line.trim();
  const cells: string[] = [];
  let cell = "";
  let lastDelimiter = -1;

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "|") {
      cell += source[index];
      continue;
    }

    let backslashes = 0;
    for (let previous = index - 1; previous >= 0 && source[previous] === "\\"; previous -= 1) {
      backslashes += 1;
    }
    if (backslashes % 2 === 1) {
      cell = cell.slice(0, -1) + "|";
    } else {
      cells.push(cell.trim());
      cell = "";
      lastDelimiter = index;
    }
  }
  cells.push(cell.trim());

  if (source.startsWith("|")) cells.shift();
  if (lastDelimiter === source.length - 1) cells.pop();
  return cells;
}

function renderNoteContent(text: string): React.ReactNode {
  const content = text.replace(NOTE_PREFIX_PATTERN, "").trim();
  const quotedToken = content.match(/^["'`]([^"'`]+)["'`]\s*(.*)$/);
  if (!quotedToken) return renderFormattedInlineText(content);

  const token = /^[-_]$/.test(quotedToken[1].trim()) ? "—" : quotedToken[1].trim();
  return (
    <>
      <code className="markdown-note-token">{token}</code>
      {quotedToken[2] ? <> {renderFormattedInlineText(quotedToken[2])}</> : null}
    </>
  );
}

const NOTE_PREFIX_PATTERN =
  /^\s*(?:\p{Extended_Pictographic}\uFE0F?\s*)?(?:\*\*)?\s*(?:note|important)\s*:?\s*(?:\*\*)?\s*/iu;

function tableFromCodeBlock(
  source: string,
): Extract<VisualizationBlock, { type: "table" }> | undefined {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source.trim());
  } catch {
    return undefined;
  }

  if (!Array.isArray(parsed) || parsed.length < 2 || !parsed.every(Array.isArray)) {
    return undefined;
  }

  const [headerRow, ...dataRows] = parsed;
  if (
    headerRow.length === 0 ||
    headerRow.length > 50 ||
    !headerRow.every((cell) => typeof cell === "string" && cell.trim())
  ) {
    return undefined;
  }

  const isScalar = (value: unknown) =>
    value === null || ["string", "number", "boolean"].includes(typeof value);
  const validRows = dataRows.filter(
    (row) => row.length === headerRow.length && row.every(isScalar),
  );
  if (!validRows.length) return undefined;

  return {
    type: "table",
    title: "Data table",
    columns: headerRow.map((header, index) => ({
      key: `${header}_${index}`,
      label: header,
    })),
    rows: validRows.slice(0, 1000),
  };
}

function renderFormattedInlineText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx}>
          {renderInlineVisualMarkers(part.slice(2, -2), `response-bold-${idx}`)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="markdown-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={idx}>{renderInlineVisualMarkers(part.slice(1, -1), `response-italic-${idx}`)}</em>
      );
    }
    return renderInlineVisualMarkers(part, `response-${idx}`);
  });
}

export const MessageBubble = memo(MessageBubbleComponent);
