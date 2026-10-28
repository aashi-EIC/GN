import type { TokenUsage } from "../../../shared/types/app";
import { reportedTokenUsage } from "../utils/tokenUsage";
import "./tokenUsageBar.css";

const numberFormat = new Intl.NumberFormat("en-US");

export function TokenUsageBar({
  usage,
  label = "Tokens used",
  limit,
  showBreakdown = true,
}: {
  usage: TokenUsage | undefined;
  label?: string;
  limit?: number;
  showBreakdown?: boolean;
}) {
  const reported = reportedTokenUsage(usage);
  if (!reported) return null;

  const filled = limit ? Math.min(1, reported.totalTokens / limit) : 1;
  const inputShare =
    reported.totalTokens > 0 ? (reported.inputTokens / reported.totalTokens) * filled * 100 : 0;
  const outputShare =
    reported.totalTokens > 0 ? (reported.outputTokens / reported.totalTokens) * filled * 100 : 0;

  return (
    <div className="token-usage-bar" role="group" aria-label={label}>
      <div className="token-usage-heading">
        <span>{label}</span>
        <strong>
          {numberFormat.format(reported.totalTokens)}{" "}
          <small>{limit ? `/ ${numberFormat.format(limit)}` : "total"}</small>
        </strong>
      </div>
      <div
        className="token-usage-track"
        aria-hidden={limit ? undefined : true}
        role={limit ? "progressbar" : undefined}
        aria-label={limit ? "Monthly token usage" : undefined}
        aria-valuemin={limit ? 0 : undefined}
        aria-valuemax={limit}
        aria-valuenow={limit ? Math.min(limit, reported.totalTokens) : undefined}
        aria-valuetext={limit ? `${reported.totalTokens} of ${limit} tokens used` : undefined}
      >
        {showBreakdown ? (
          <>
            <span className="token-usage-input" style={{ width: `${inputShare}%` }} />
            <span className="token-usage-output" style={{ width: `${outputShare}%` }} />
          </>
        ) : (
          <span className="token-usage-total" style={{ width: `${filled * 100}%` }} />
        )}
      </div>
      {showBreakdown && (
        <div className="token-usage-legend">
          <span>
            <i className="token-usage-input" aria-hidden="true" />
            Input <strong>{numberFormat.format(reported.inputTokens)}</strong>
          </span>
          <span>
            <i className="token-usage-output" aria-hidden="true" />
            Output <strong>{numberFormat.format(reported.outputTokens)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
