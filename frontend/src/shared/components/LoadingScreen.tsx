export function LoadingScreen({ text = "Signing in..." }: { text?: string }) {
  return (
    <main className="loading-screen">
      <div className="signing-in-loader">
        <div className="star-loader-wrap">
          <div className="rotating-outer-ring" />
          <div className="inner-star-circle">
            <svg viewBox="0 0 24 24" className="star-svg">
              <path
                fill="#ffffff"
                d="M12 2.5L14.3 9.7L21.5 12L14.3 14.3L12 21.5L9.7 14.3L2.5 12L9.7 9.7L12 2.5Z"
              />
            </svg>
          </div>
        </div>
        <span className="signing-in-text">{text}</span>
      </div>
    </main>
  );
}
