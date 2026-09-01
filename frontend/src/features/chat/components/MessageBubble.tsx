import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Info,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { FeedbackValue, Message, VisualizationBlock } from "../../../shared/types/app";
import { IconButton } from "../../../shared/components/ui/IconButton";
import { StructuredTable, VisualizationRenderer } from "./charts/VisualizationRenderer";
import { removeChartScriptSections } from "../utils/responseDisplay";
import "./messageBubbleMarkdown.css";

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
      <motion.article
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`response ${isError ? "response-error-state" : ""}`}
      >
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

        {message.metrics && message.metrics.length > 0 && (
          <div className="metric-grid kpi-card-grid">
            {message.metrics.map((metric) => (
              <div className={`metric kpi-card ${metric.tone || ""}`} key={metric.label}>
                <div className="kpi-card-header">
                  <span className="kpi-label">{metric.label}</span>
                  {metric.tone === "positive" || metric.tone === "good" ? (
                    <CheckCircle2 size={14} className="kpi-icon positive" />
                  ) : metric.tone === "watch" ? (
                    <AlertTriangle size={14} className="kpi-icon watch" />
                  ) : (
                    <Activity size={14} className="kpi-icon neutral" />
                  )}
                </div>
                <b className="kpi-value">{metric.value}</b>
                {metric.subtext && <span className="kpi-subtext">{metric.subtext}</span>}
              </div>
            ))}
          </div>
        )}

        {message.visualizations && message.visualizations.length > 0 && (
          <VisualizationRenderer blocks={message.visualizations} />
        )}

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
            <div className="debug-panel-heading">
              <Code2 />
              <span>Admin debug mode</span>
              <b>node-bff</b>
            </div>
            <DebugPayload title="Request sent to BFF" value={message.mcpRequest} defaultOpen />
            <DebugPayload
              title="Raw MCP response"
              value={message.debug.find((event) => event.stage === "mcp_response")?.payload}
              defaultOpen
            />
            <DebugPayload
              title="Processed BFF response"
              value={message.debug.find((event) => event.stage === "bff_response")?.payload}
              defaultOpen
            />
            <DebugPayload title="Processing events" value={message.debug} />
          </div>
        )}
      </motion.article>
    </div>
  );
}

function DebugPayload({
  title,
  value,
  defaultOpen = false,
}: {
  title: string;
  value: unknown;
  defaultOpen?: boolean;
}) {
  const available = value !== undefined;
  const content = available ? JSON.stringify(value, null, 2) : "";

  return (
    <details className="debug-payload" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {available && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void navigator.clipboard.writeText(content);
            }}
          >
            <Copy />
            Copy JSON
          </button>
        )}
      </summary>
      {available ? (
        <pre>{content}</pre>
      ) : (
        <p className="debug-payload-empty">
          Not captured for this message. Keep debug enabled and send a new prompt.
        </p>
      )}
    </details>
  );
}

const insightPrefixPattern =
  /^\s*>?\s*(?:#{1,6}\s*)?(?:\p{Extended_Pictographic}\uFE0F?\s*)?(?:\*\*)?\s*(?:key\s+)?findings\s*(?:\/|&|and)\s*insights\s*:?\s*(?:\*\*)?\s*/iu;

function hasInsightPrefix(value: string) {
  return insightPrefixPattern.test(value);
}

function stripInsightPrefix(value: string) {
  if (hasInsightPrefix(value)) {
    return value.replace(insightPrefixPattern, "").trim();
  }

  return value.replace(/^\s*>\s*/, "").trim();
}

function SafeResponseText({ text }: { text: string }) {
  const renderedElements = useMemo(() => {
    if (!text) return null;

    const visibleText = removeChartScriptSections(text);

    // Split text by code blocks ```code```
    const blocks = visibleText.split(/(```[\s\S]*?```)/g);

    return blocks.map((block, blockIdx) => {
      if (block.startsWith("```") && block.endsWith("```")) {
        const lines = block.slice(3, -3).trim().split("\n");
        const language = lines[0]?.match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : "";
        const codeContent = language ? lines.slice(1).join("\n") : lines.join("\n");

        if (/^(?:chartType|chart_type|chart)\s*:/i.test(codeContent.trim())) {
          return null;
        }

        const tableBlock = tableFromCodeBlock(codeContent);

        if (tableBlock) {
          return <StructuredTable key={`table-code-${blockIdx}`} block={tableBlock} />;
        }

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

      // Process regular markdown lines (headers, lists, KPI card grids, blockquotes, paragraphs)
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
          isMarkdownTableSeparator(lines[lineIdx + 1])
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
              <StructuredTable block={tableBlock} minimal={true} />
            </div>,
          );
          return;
        }

        // Check for KPI metric bullet lines: - **Label**: Value (Subtext) or - Label: Value
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

        // Regular bullet point lines (- item or * item or • item)
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

        // Render insight blocks with one consistent card header.
        if (hasInsightPrefix(trimmed)) {
          flushList(`${blockIdx}-${lineIdx}`);
          flushKpiList(`${blockIdx}-${lineIdx}`);
          flushBlockquote(`${blockIdx}-${lineIdx}`);
          collectingInsight = true;
          const bqText = stripInsightPrefix(trimmed);
          if (bqText) currentInsight.push(bqText);
          return;
        }

        // Render regular blockquotes (or continue insight block)
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

        // Flush all buffers if we hit a normal line
        flushList(`${blockIdx}-${lineIdx}`);
        flushKpiList(`${blockIdx}-${lineIdx}`);
        flushInsight(`${blockIdx}-${lineIdx}`);
        flushBlockquote(`${blockIdx}-${lineIdx}`);

        if (!trimmed) {
          return;
        }

        if (/^_{3,}$|^-{3,}$|^\*{3,}$/.test(trimmed)) {
          elements.push(<hr key={`hr-${lineIdx}`} className="markdown-divider" />);
          return;
        }

        if (/^[^a-z0-9]*findings\s*\/\s*insights\s*:/i.test(trimmed)) {
          elements.push(<InsightHeader key={`insight-${lineIdx}`} />);
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
      flushKpiList(`${blockIdx}-end`);
      flushInsight(`${blockIdx}-end`);
      flushBlockquote(`${blockIdx}-end`);
      return <div key={`block-${blockIdx}`}>{elements}</div>;
    });
  }, [text]);

  return <div className="markdown-response-body">{renderedElements}</div>;
}

function InsightHeader() {
  return (
    <div className="executive-insight-block insight-pill">
      <div className="executive-insight-header" style={{ marginBottom: 0 }}>
        <Sparkles size={14} className="executive-insight-sparkle" />
        <span>Findings &amp; Insights</span>
      </div>
    </div>
  );
}

function isMarkdownTableRow(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.split("|").length >= 4;
}

function isMarkdownTableSeparator(line: string) {
  if (!isMarkdownTableRow(line)) return false;
  return parseMarkdownTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdownTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
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
  // Regex to match **bold**, `code`, *italic*, and supported visual markers.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|📊)/g);

  return parts.map((part, idx) => {
    if (part === "📊") {
      return (
        <ChartNoAxesCombined key={idx} className="markdown-inline-chart-icon" aria-hidden="true" />
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="markdown-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export const MessageBubble = memo(MessageBubbleComponent);
