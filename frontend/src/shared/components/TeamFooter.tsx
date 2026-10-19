export function TeamFooter({ className = "" }: { className?: string }) {
  return (
    <div className={`welcome-team-footer ${className}`.trim()}>
      <span className="wtf-item wtf-brand">Business Intelligence &amp; Analytics</span>
      <span className="wtf-dot" aria-hidden="true">
        •
      </span>
      <span className="wtf-item wtf-tagline">Conversational experience, fast insights</span>
      <span className="wtf-dot" aria-hidden="true">
        •
      </span>
      <span className="wtf-item wtf-team">Team @ GN-CPX</span>
    </div>
  );
}
