import "./teamBranding.css";

export function TeamBranding() {
  return (
    <footer className="team-branding" aria-label="Team branding">
      <span className="team-branding-name">Business Intelligence &amp; Analytics</span>
      <span className="team-branding-separator" aria-hidden="true">
        ·
      </span>
      <span>Conversational experience, fast insights</span>
      <span className="team-branding-separator" aria-hidden="true">
        ·
      </span>
      <span>Team @ GN-CPX</span>
    </footer>
  );
}
