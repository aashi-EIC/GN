import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronRight,
  CircleCheckBig,
  Code2,
  Copy,
  Database,
  Download,
  MessagesSquare,
  Search,
  Timer,
  TriangleAlert,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { DebugEvent, Message } from "../../../shared/types/app";

type DebugTabId = "overview" | "request" | "mcp" | "dax" | "bff" | "events";

type DebugTab = {
  id: DebugTabId;
  label: string;
  value?: unknown;
};

const sensitiveKeyPattern =
  /(?:authorization|bearer|token|api[-_]?key|secret|password|passwd|cookie)/i;
const previewEntryLimit = 100;
const previewCharacterLimit = 12_000;
const debugZoomMin = 80;
const debugZoomMax = 150;
const debugZoomDefault = 100;
const debugZoomButtonStep = 10;
const debugZoomStorageKey = "conversational-bi.debug-zoom";
const trackpadPixelsPerZoomPercent = 8;
const trackpadMaxZoomStep = 3;

type PendingZoomFocus = {
  anchor: HTMLElement;
  dataViewport: HTMLElement;
  drawerContent: HTMLElement;
  clientX: number;
  clientY: number;
  anchorOffsetX: number;
  anchorOffsetY: number;
  scaleRatio: number;
};

function clampDebugZoom(value: number) {
  return Math.min(debugZoomMax, Math.max(debugZoomMin, Math.round(value)));
}

function readDebugZoomLevel() {
  try {
    const savedZoom = Number(localStorage.getItem(debugZoomStorageKey));
    return Number.isFinite(savedZoom) ? clampDebugZoom(savedZoom) : debugZoomDefault;
  } catch {
    return debugZoomDefault;
  }
}

export function DebugDrawer({
  message,
  open,
  onClose,
}: {
  message: Message;
  open: boolean;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const wheelZoomDeltaRef = useRef(0);
  const lastWheelZoomAtRef = useRef(0);
  const pendingZoomFocusRef = useRef<PendingZoomFocus | null>(null);
  const [activeTab, setActiveTab] = useState<DebugTabId>("overview");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(readDebugZoomLevel);

  const zoomOut = () =>
    setZoomLevel((current) => clampDebugZoom(current - debugZoomButtonStep));
  const zoomIn = () =>
    setZoomLevel((current) => clampDebugZoom(current + debugZoomButtonStep));
  const resetZoom = () => setZoomLevel(debugZoomDefault);

  const debugData = useMemo(() => buildDebugData(message), [message]);
  const tabs = useMemo<DebugTab[]>(
    () =>
      [
        { id: "overview", label: "Overview" },
        { id: "request", label: "Request", value: message.mcpRequest },
        { id: "mcp", label: "MCP response", value: debugData.rawMcpResponse },
        { id: "dax", label: "Generated DAX", value: debugData.generatedDax },
        { id: "bff", label: "BFF response", value: debugData.bffResponse },
        { id: "events", label: "Events", value: message.debug },
      ].filter((tab) => tab.id === "overview" || hasUsefulValue(tab.value)) as DebugTab[],
    [debugData, message.debug, message.mcpRequest],
  );
  const selectedTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) ?? tabs[0],
    [activeTab, tabs],
  );
  const safeSelectedValue = useMemo(() => redactSensitiveValues(selectedTab?.value), [selectedTab]);
  const selectedJson = useMemo(() => safeStringify(safeSelectedValue), [safeSelectedValue]);

  useEffect(() => {
    if (!open) return undefined;
    const previousActiveElement = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          zoomIn();
          return;
        }
        if (event.key === "-") {
          event.preventDefault();
          zoomOut();
          return;
        }
        if (event.key === "0") {
          event.preventDefault();
          resetZoom();
          return;
        }
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (previousActiveElement instanceof HTMLElement) previousActiveElement.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    try {
      localStorage.setItem(debugZoomStorageKey, String(zoomLevel));
    } catch {
      // Zoom still works for this drawer when browser storage is unavailable.
    }
  }, [zoomLevel]);

  useLayoutEffect(() => {
    const pending = pendingZoomFocusRef.current;
    if (!pending) return;
    pendingZoomFocusRef.current = null;

    const { anchor, dataViewport, drawerContent } = pending;
    if (!anchor.isConnected || !dataViewport.isConnected || !drawerContent.isConnected) return;

    const anchorRect = anchor.getBoundingClientRect();
    const desiredAnchorX =
      anchorRect.left + pending.anchorOffsetX * pending.scaleRatio - pending.clientX;
    dataViewport.scrollLeft += desiredAnchorX;

    const horizontallyAdjustedRect = anchor.getBoundingClientRect();
    const desiredAnchorY =
      horizontallyAdjustedRect.top + pending.anchorOffsetY * pending.scaleRatio - pending.clientY;
    drawerContent.scrollTop += desiredAnchorY;
  }, [zoomLevel]);

  useEffect(() => {
    if (!open) return undefined;

    const zoomRegions = Array.from(
      drawerRef.current?.querySelectorAll<HTMLElement>(".debug-zoom-gesture-region") ?? [],
    );
    const handleTrackpadZoom = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (event.deltaY === 0) return;

      const now = performance.now();
      const previousDelta = wheelZoomDeltaRef.current;
      const directionChanged = previousDelta !== 0 && Math.sign(previousDelta) !== Math.sign(event.deltaY);
      if (now - lastWheelZoomAtRef.current > 240 || directionChanged) {
        wheelZoomDeltaRef.current = 0;
      }
      lastWheelZoomAtRef.current = now;
      wheelZoomDeltaRef.current += event.deltaY;
      const accumulatedDelta = wheelZoomDeltaRef.current;
      const availableSteps = Math.floor(
        Math.abs(accumulatedDelta) / trackpadPixelsPerZoomPercent,
      );
      if (availableSteps < 1) return;

      const zoomStep = Math.min(trackpadMaxZoomStep, availableSteps);
      const zoomChange = accumulatedDelta < 0 ? zoomStep : -zoomStep;
      wheelZoomDeltaRef.current -=
        Math.sign(accumulatedDelta) * zoomStep * trackpadPixelsPerZoomPercent;

      const target = event.target instanceof Element ? event.target : null;
      const dataViewport = target?.closest<HTMLElement>(
        ".debug-json-tree, .debug-search-results, .debug-dax-code",
      );
      const drawerContent = drawerRef.current?.querySelector<HTMLElement>(".debug-drawer-content");
      const anchor = target?.closest<HTMLElement>(
        ".debug-json-leaf, .debug-json-node > summary, .debug-search-results > span, .debug-dax-code li",
      );

      setZoomLevel((current) => {
        const next = clampDebugZoom(current + zoomChange);
        if (next === current) return current;

        if (anchor && dataViewport && drawerContent) {
          const anchorRect = anchor.getBoundingClientRect();
          pendingZoomFocusRef.current = {
            anchor,
            dataViewport,
            drawerContent,
            clientX: event.clientX,
            clientY: event.clientY,
            anchorOffsetX: event.clientX - anchorRect.left,
            anchorOffsetY: event.clientY - anchorRect.top,
            scaleRatio: next / current,
          };
        }

        return next;
      });
    };

    zoomRegions.forEach((region) =>
      region.addEventListener("wheel", handleTrackpadZoom, { passive: false }),
    );
    return () => {
      wheelZoomDeltaRef.current = 0;
      zoomRegions.forEach((region) => region.removeEventListener("wheel", handleTrackpadZoom));
    };
  }, [activeTab, open]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) setActiveTab("overview");
  }, [activeTab, tabs]);

  useEffect(() => {
    setSearch("");
    setCopied(false);
    setShowFull(false);
  }, [activeTab, message.id]);

  if (!open) return null;

  const status = getDebugStatus(message.debug);

  const copySelected = async () => {
    if (!selectedJson) return;
    await navigator.clipboard.writeText(selectedJson);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadSelected = () => {
    if (!selectedJson) return;
    const blob = new Blob([selectedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `debug-${message.id}-${selectedTab.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="debug-drawer-layer" role="presentation">
      <button
        type="button"
        className="debug-drawer-backdrop"
        aria-label="Close debug details"
        onClick={onClose}
      />
      <section
        ref={drawerRef}
        className="debug-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`debug-title-${message.id}`}
      >
        <header className="debug-drawer-header">
          <div className="debug-drawer-title">
            <span className="debug-drawer-title-icon" aria-hidden="true">
              <Code2 />
            </span>
            <div>
              <h2 id={`debug-title-${message.id}`}>Debug details</h2>
              <p>
                <span className={`debug-status-dot ${status.tone}`} />
                {status.label} {"\u00b7"} node-bff
              </p>
            </div>
          </div>
          <div className="debug-drawer-header-actions">
            <div className="debug-zoom-controls" role="group" aria-label="Debug content zoom">
              <span className="debug-zoom-label">Zoom</span>
              <button
                type="button"
                aria-label="Zoom out debug content"
                title="Zoom out (Ctrl/Cmd -)"
                disabled={zoomLevel <= debugZoomMin}
                onClick={zoomOut}
              >
                <ZoomOut aria-hidden="true" />
              </button>
              <button
                type="button"
                className="debug-zoom-value"
                data-modified={zoomLevel !== 100}
                aria-label={`Debug content zoom ${zoomLevel}%. Reset to 100%`}
                title="Reset zoom to 100% (Ctrl/Cmd 0)"
                onClick={resetZoom}
              >
                <span aria-live="polite">{zoomLevel}%</span>
              </button>
              <button
                type="button"
                aria-label="Zoom in debug content"
                title="Zoom in (Ctrl/Cmd +)"
                disabled={zoomLevel >= debugZoomMax}
                onClick={zoomIn}
              >
                <ZoomIn aria-hidden="true" />
              </button>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="debug-drawer-close"
              aria-label="Close debug details"
              onClick={onClose}
            >
              <X />
            </button>
          </div>
        </header>

        <nav className="debug-drawer-tabs" aria-label="Debug sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div
          className="debug-drawer-content"
          data-zoom={zoomLevel}
          style={
            {
              "--debug-readable-font-size": `${((11 * zoomLevel) / 100).toFixed(2)}px`,
            } as CSSProperties
          }
        >
            {selectedTab.id === "overview" ? (
              <DebugOverview message={message} events={message.debug ?? []} />
            ) : selectedTab.id === "events" ? (
              <DebugEvents events={message.debug ?? []} />
            ) : selectedTab.id === "dax" ? (
              <DaxQueryViewer value={safeSelectedValue} messageId={message.id} />
            ) : (
              <>
                <div className="debug-data-toolbar">
                  <div className="debug-data-search">
                    <Search aria-hidden="true" />
                    <input
                      type="search"
                      value={search}
                      placeholder="Search keys or values"
                      aria-label={`Search ${selectedTab.label}`}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    {search ? (
                      <button
                        type="button"
                        className="debug-data-search-clear"
                        aria-label="Clear debug search"
                        title="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <X aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => void copySelected()} disabled={!selectedJson}>
                    {copied ? <Check /> : <Copy />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button type="button" onClick={downloadSelected} disabled={!selectedJson}>
                    <Download />
                    Download
                  </button>
                </div>

                <div
                  className="debug-zoom-gesture-region"
                  title="Pinch here or use Ctrl/Cmd + scroll to zoom"
                >
                  <DebugDataView value={safeSelectedValue} query={search} showFull={showFull} />
                </div>

                {selectedJson.length > previewCharacterLimit && !search && (
                  <button
                    type="button"
                    className="debug-show-full"
                    onClick={() => setShowFull((current) => !current)}
                  >
                    {showFull ? "Show compact response" : "Show full response"}
                  </button>
                )}
              </>
            )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function DaxQueryViewer({ value, messageId }: { value: unknown; messageId: string }) {
  const [copiedQuery, setCopiedQuery] = useState<number | "all" | null>(null);
  const queries = useMemo(() => readDaxQueries(value), [value]);
  const formattedQueries = useMemo(() => queries.map(formatDaxQuery), [queries]);
  const combinedQueries = useMemo(
    () =>
      formattedQueries
        .map((query, index) => (queries.length > 1 ? `// Query ${index + 1}\n${query}` : query))
        .join("\n\n"),
    [formattedQueries, queries.length],
  );

  if (!queries.length) {
    return <p className="debug-empty-state">No DAX query was generated for this response.</p>;
  }

  const markCopied = (query: number | "all") => {
    setCopiedQuery(query);
    window.setTimeout(() => setCopiedQuery(null), 1600);
  };

  return (
    <div className="debug-dax-viewer">
      <div className="debug-dax-toolbar">
        <div>
          <strong>Generated DAX</strong>
          <span>
            {queries.length} {queries.length === 1 ? "query" : "queries"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(combinedQueries);
            markCopied("all");
          }}
        >
          {copiedQuery === "all" ? <Check /> : <Copy />}
          {copiedQuery === "all" ? "Copied" : "Copy all"}
        </button>
        <button
          type="button"
          onClick={() => downloadTextFile(combinedQueries, `generated-dax-${messageId}.dax`)}
        >
          <Download />
          Download
        </button>
      </div>

      <div
        className="debug-dax-list debug-zoom-gesture-region"
        title="Pinch here or use Ctrl/Cmd + scroll to zoom"
      >
        {formattedQueries.map((query, queryIndex) => {
          const lines = query.split("\n");
          return (
            <section className="debug-dax-card" key={`${queryIndex}-${query.slice(0, 40)}`}>
              <header>
                <div>
                  <Code2 aria-hidden="true" />
                  <strong>Query {queryIndex + 1}</strong>
                  <span>DAX</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(query);
                    markCopied(queryIndex);
                  }}
                >
                  {copiedQuery === queryIndex ? <Check /> : <Copy />}
                  {copiedQuery === queryIndex ? "Copied" : "Copy query"}
                </button>
              </header>
              <ol className="debug-dax-code" aria-label={`Generated DAX query ${queryIndex + 1}`}>
                {lines.map((line, lineIndex) => (
                  <li key={`${lineIndex}-${line}`}>
                    <code>{renderDaxSyntax(line)}</code>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DebugOverview({ message, events }: { message: Message; events: DebugEvent[] }) {
  const rawResponse = events.find((event) => event.stage === "mcp_response")?.payload;
  const bffResponse = events.find((event) => event.stage === "bff_response")?.payload;
  const sessionId =
    readString(rawResponse, "session_id") ??
    readString(bffResponse, "mcp_session_id") ??
    readNestedString(bffResponse, ["mcp_session", "id"]);
  const sessionStatus =
    readString(rawResponse, "session_status") ??
    readNestedString(bffResponse, ["mcp_session", "status"]);
  const elapsed = getElapsedTime(message.mcpRequest?.sent_at, message.createdAt);
  const status = getDebugStatus(events);

  const cards = [
    {
      label: "Status",
      value: status.label,
      icon: status.tone === "warning" ? TriangleAlert : CircleCheckBig,
      tone: status.tone,
    },
    {
      label: "Semantic model",
      value: message.mcpRequest?.semantic_model_id ?? "Unavailable",
      icon: Database,
      tone: "model",
    },
    { label: "Response time", value: elapsed, icon: Timer, tone: "timing" },
    {
      label: "Session",
      value: sessionStatus ?? "Unavailable",
      icon: MessagesSquare,
      tone: "session",
    },
  ];

  return (
    <div className="debug-overview">
      <div className="debug-summary-grid">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="debug-summary-card">
            <span className={`debug-summary-icon ${tone ?? ""}`}>
              <Icon aria-hidden="true" strokeWidth={1.8} />
            </span>
            <div>
              <span>{label}</span>
              <strong title={String(value)}>{value}</strong>
            </div>
          </article>
        ))}
      </div>

      <dl className="debug-identifiers">
        <DebugIdentifier label="Request ID" value={message.mcpRequest?.request_id} />
        <DebugIdentifier label="MCP session ID" value={sessionId} />
        <DebugIdentifier label="Sent at" value={formatTimestamp(message.mcpRequest?.sent_at)} />
      </dl>

      <div className="debug-overview-events">
        <h3>Processing summary</h3>
        <DebugEvents events={events} compact />
      </div>
    </div>
  );
}

function DebugIdentifier({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  const displayValue = value || "Unavailable";

  return (
    <div>
      <dt>{label}</dt>
      <dd title={displayValue}>{displayValue}</dd>
      {value && (
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? <Check /> : <Copy />}
        </button>
      )}
    </div>
  );
}

function DebugEvents({ events, compact = false }: { events: DebugEvent[]; compact?: boolean }) {
  if (!events.length) {
    return <p className="debug-empty-state">No processing events were captured.</p>;
  }

  return (
    <ol className={`debug-event-list ${compact ? "compact" : ""}`}>
      {events.map((event, index) => (
        <li key={`${event.stage}-${index}`} className={event.status}>
          <span className="debug-event-marker" aria-hidden="true" />
          <div>
            <div className="debug-event-heading">
              <strong>{formatStageName(event.stage)}</strong>
              <span>{event.status}</span>
            </div>
            <p>{event.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function DebugDataView({
  value,
  query,
  showFull,
}: {
  value: unknown;
  query: string;
  showFull: boolean;
}) {
  if (!hasUsefulValue(value)) {
    return <p className="debug-empty-state">No data was returned for this section.</p>;
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery) {
    const matchingLines = safeStringify(value)
      .split("\n")
      .filter((line) => line.toLowerCase().includes(normalizedQuery))
      .slice(0, 250);
    return matchingLines.length ? (
      <pre className="debug-search-results">
        {matchingLines.map((line, index) => (
          <span key={`${line}-${index}`}>{highlightText(line, query)}</span>
        ))}
      </pre>
    ) : (
      <p className="debug-empty-state">No keys or values match “{query}”.</p>
    );
  }

  return (
    <div className="debug-json-tree">
      <JsonNode value={value} depth={0} showFull={showFull} />
    </div>
  );
}

function JsonNode({
  value,
  name,
  depth,
  showFull,
}: {
  value: unknown;
  name?: string;
  depth: number;
  showFull: boolean;
}) {
  if (value === null || typeof value !== "object") {
    const displayValue =
      typeof value === "string" && !showFull && value.length > 2_000
        ? `${value.slice(0, 2_000)}…`
        : value;
    return (
      <div className="debug-json-leaf">
        {name && <span className="debug-json-key">{name}: </span>}
        <span className={`debug-json-${typeof value}`}>{formatPrimitive(displayValue)}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>);
  const visibleEntries = showFull ? entries : entries.slice(0, previewEntryLimit);
  const containerLabel = Array.isArray(value)
    ? `[${entries.length} ${entries.length === 1 ? "item" : "items"}]`
    : `{${entries.length} ${entries.length === 1 ? "key" : "keys"}}`;

  return (
    <details className="debug-json-node" open={depth < 2}>
      <summary>
        <ChevronRight aria-hidden="true" />
        {name && <span className="debug-json-key">{name}</span>}
        <span className="debug-json-count">{containerLabel}</span>
      </summary>
      <div className="debug-json-children">
        {visibleEntries.map(([key, childValue]) => (
          <JsonNode key={key} name={key} value={childValue} depth={depth + 1} showFull={showFull} />
        ))}
        {visibleEntries.length < entries.length && (
          <p className="debug-json-truncated">
            {entries.length - visibleEntries.length} more entries hidden
          </p>
        )}
      </div>
    </details>
  );
}

function buildDebugData(message: Message) {
  const events = message.debug ?? [];
  return {
    rawMcpResponse: events.find((event) => event.stage === "mcp_response")?.payload,
    generatedDax: events.find((event) => event.stage === "generated_dax_query")?.payload,
    bffResponse: events.find((event) => event.stage === "bff_response")?.payload,
  };
}

function readDaxQueries(value: unknown): string[] {
  if (typeof value === "string") {
    const query = stripDaxFence(value).trim();
    return query ? [query] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((query) => {
    if (typeof query !== "string") return [];
    const normalized = stripDaxFence(query).trim();
    return normalized ? [normalized] : [];
  });
}

function stripDaxFence(query: string) {
  return query.replace(/^\s*```(?:dax)?\s*/i, "").replace(/\s*```\s*$/, "");
}

function formatDaxQuery(query: string) {
  const normalized = query.replace(/\r\n?/g, "\n").trim();
  if (normalized.split("\n").length > 2) {
    return normalized
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n");
  }

  const prepared = normalized.replace(
    /\s+(?=(?:DEFINE|EVALUATE|MEASURE|VAR|RETURN|ORDER\s+BY|START\s+AT)\b)/gi,
    "\n",
  );
  let formatted = "";
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let bracketed = false;
  let pendingSpace = false;

  const appendIndent = () => {
    formatted += "  ".repeat(Math.max(0, depth));
  };
  const appendNewline = () => {
    formatted = formatted.trimEnd();
    if (!formatted.endsWith("\n")) formatted += "\n";
    appendIndent();
    pendingSpace = false;
  };

  for (let index = 0; index < prepared.length; index += 1) {
    const character = prepared[index];
    const next = prepared[index + 1];

    if (quote) {
      formatted += character;
      if (character === quote) {
        if (next === quote) {
          formatted += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (bracketed) {
      formatted += character;
      if (character === "]") bracketed = false;
      continue;
    }
    if (character === '"' || character === "'") {
      if (pendingSpace && formatted && !formatted.endsWith("\n")) formatted += " ";
      pendingSpace = false;
      quote = character;
      formatted += character;
      continue;
    }
    if (character === "[") {
      if (pendingSpace && formatted && !formatted.endsWith("\n")) formatted += " ";
      pendingSpace = false;
      bracketed = true;
      formatted += character;
      continue;
    }
    if (character === "(") {
      formatted = formatted.trimEnd() + "(";
      depth += 1;
      if (next && next !== ")") appendNewline();
      continue;
    }
    if (character === ")") {
      depth = Math.max(0, depth - 1);
      formatted = formatted.trimEnd();
      if (!formatted.endsWith("\n")) formatted += "\n";
      appendIndent();
      formatted += ")";
      pendingSpace = false;
      continue;
    }
    if (character === "," || character === ";") {
      formatted = formatted.trimEnd() + character;
      appendNewline();
      continue;
    }
    if (character === "\n") {
      appendNewline();
      continue;
    }
    if (/\s/.test(character)) {
      pendingSpace = true;
      continue;
    }
    if (pendingSpace && formatted && !formatted.endsWith("\n") && !formatted.endsWith("(")) {
      formatted += " ";
    }
    pendingSpace = false;
    formatted += character;
  }

  return formatted
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.trim() || (index > 0 && lines[index - 1].trim()))
    .join("\n")
    .trim();
}

const daxKeywordPattern =
  /(--.*$|\/\/.*$|"(?:[^"]|"")*"|'(?:[^']|'')*'|\[[^\]]+\]|\b(?:ASC|BLANK|CALCULATE|DEFINE|DESC|EVALUATE|FILTER|KEEPFILTERS|MEASURE|ORDER|RETURN|START|SUMMARIZE|SUMMARIZECOLUMNS|VAR)\b|\b\d+(?:\.\d+)?\b)/gi;
const daxKeywords = new Set([
  "asc",
  "blank",
  "calculate",
  "define",
  "desc",
  "evaluate",
  "filter",
  "keepfilters",
  "measure",
  "order",
  "return",
  "start",
  "summarize",
  "summarizecolumns",
  "var",
]);

function renderDaxSyntax(line: string) {
  const tokens = line.split(daxKeywordPattern);
  return tokens.map((token, index) => {
    if (!token) return null;
    const normalized = token.toLowerCase();
    let className = "";
    if (token.startsWith("--") || token.startsWith("//")) className = "comment";
    else if (token.startsWith('"') || token.startsWith("'")) className = "string";
    else if (token.startsWith("[")) className = "measure";
    else if (daxKeywords.has(normalized)) className = "keyword";
    else if (/^\d/.test(token)) className = "number";
    return className ? (
      <span className={`dax-token-${className}`} key={`${index}-${token}`}>
        {token}
      </span>
    ) : (
      token
    );
  });
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getDebugStatus(events?: DebugEvent[]) {
  const hasError = events?.some(
    (event) => event.stage === "request_error" || event.status === "warning",
  );
  return hasError
    ? { label: "Needs attention", tone: "warning" }
    : { label: "Successful", tone: "success" };
}

function redactSensitiveValues(value: unknown, key = "", depth = 0): unknown {
  if (sensitiveKeyPattern.test(key)) return "[REDACTED]";
  if (depth >= 15 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item, "", depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
      childKey,
      redactSensitiveValues(childValue, childKey, depth + 1),
    ]),
  );
}

function hasUsefulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function readString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

function readNestedString(value: unknown, path: string[]) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.trim() ? current : undefined;
}

function getElapsedTime(start?: string, end?: string) {
  if (!start || !end) return "Unavailable";
  const elapsedMs = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "Unavailable";
  if (elapsedMs < 1_000) return `${elapsedMs} ms`;
  if (elapsedMs < 60_000) return `${(elapsedMs / 1_000).toFixed(1)} s`;
  return `${(elapsedMs / 60_000).toFixed(1)} min`;
}

function formatTimestamp(value?: string) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatStageName(stage: string) {
  return stage
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function safeStringify(value: unknown) {
  try {
    return value === undefined ? "" : JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function formatPrimitive(value: unknown) {
  if (typeof value === "string") return `"${value}"`;
  if (value === undefined) return "undefined";
  return String(value);
}

function highlightText(line: string, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return line;
  const parts = line.split(new RegExp(`(${escapeRegExp(normalizedQuery)})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === normalizedQuery.toLowerCase() ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      part
    ),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}