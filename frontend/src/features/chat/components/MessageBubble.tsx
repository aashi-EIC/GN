import { memo } from "react";
import { Check, Code2, Copy, Sparkles, ThumbsDown, ThumbsUp, AlertTriangle } from "lucide-react";
import type { FeedbackValue, Message, ToastState } from "../../../shared/types/app";
import { BarChart } from "./charts/BarChart";
import { HtmlPlot } from "./charts/HtmlPlot";
import { InsightTable } from "./charts/InsightTable";
import { IconButton } from "../../../shared/components/ui/IconButton";

function MessageBubbleComponent({
  message,
  debugOpen,
  feedback,
  copyMessage,
  markFeedback,
  showToast,
  onReportError,
}: {
  message: Message;
  debugOpen: boolean;
  feedback?: FeedbackValue;
  copyMessage: (message: Message) => void;
  markFeedback: (messageId: string, value: FeedbackValue) => void;
  showToast: (message: string, tone?: ToastState["tone"]) => void;
  onReportError: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="user-row">
        <div>{message.text}</div>
      </div>
    );
  }

  return (
    <div className="assistant-row">
      <div className="ai-mark">
        <Sparkles />
      </div>
      <article className="response">
        <p>{message.text}</p>

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

        {message.chart && (
          <BarChart title={message.chartTitle ?? "Trend"} data={message.chart} />
        )}

        {message.table && <InsightTable table={message.table} />}

        {message.plot && <HtmlPlot plot={message.plot} showToast={showToast} />}

        {message.actions && (
          <div className="action-list">
            {message.actions.map((action) => (
              <span key={action}>
                <Check />
                {action}
              </span>
            ))}
          </div>
        )}



        <div className="response-actions">
          <IconButton label="Copy response" onClick={() => copyMessage(message)}>
            <Copy />
          </IconButton>
          <IconButton
            label="Mark helpful"
            active={feedback === "helpful"}
            onClick={() => markFeedback(message.id, "helpful")}
          >
            <ThumbsUp />
          </IconButton>
          <IconButton
            label="Mark not helpful"
            active={feedback === "not-helpful"}
            onClick={() => markFeedback(message.id, "not-helpful")}
          >
            <ThumbsDown />
          </IconButton>
          <IconButton
            label="Report an error"
            onClick={onReportError}
          >
            <AlertTriangle />
          </IconButton>
        </div>

        {debugOpen && message.debug && (
          <div className="debug-panel">
            <div>
              <Code2 />
              <span>Admin debug mode</span>
              <b>{message.mcpResponseSource ?? "node-bff"}</b>
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

export const MessageBubble = memo(MessageBubbleComponent);
