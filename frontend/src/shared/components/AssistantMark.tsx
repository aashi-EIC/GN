export function AssistantMark() {
  return (
    <div className="ai-mark assistant-mark" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" focusable="false">
        <path
          className="assistant-mark-primary"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M10.5 4.5c1.2 5.8 2.7 7.3 8.5 8.5-5.8 1.2-7.3 2.7-8.5 8.5-1.2-5.8-2.7-7.3-8.5-8.5 5.8-1.2 7.3-2.7 8.5-8.5Zm0 5.9L8.4 13l2.1 2.6 2.1-2.6-2.1-2.6Z"
        />
        <path
          className="assistant-mark-secondary"
          d="M19 2.5c.5 2.3 1.2 3 3.5 3.5-2.3.5-3 1.2-3.5 3.5-.5-2.3-1.2-3-3.5-3.5 2.3-.5 3-1.2 3.5-3.5Z"
        />
      </svg>
    </div>
  );
}
