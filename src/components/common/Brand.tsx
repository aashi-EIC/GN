export function BrandMark({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <div className={`brand ${light ? "light" : ""} ${compact ? "compact" : ""}`}>
      <img
        src={compact ? "/gracenote-favicon.svg" : "/gracenote-logo.svg"}
        alt={compact ? "Gracenote" : "gracenote, a nielsen company"}
        className="brand-logo-img"
      />
    </div>
  );
}

export function AskBrandMark() {
  return (
    <span className="ask-brand">
      <span className="ask-brand-icon">
        <img src="/gracenote-favicon.svg" alt="" />
      </span>
      <span>Ask Gracenote</span>
    </span>
  );
}

export function MicrosoftMark() {
  return (
    <span className="ms-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
