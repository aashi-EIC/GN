import { useEffect, useState, type ReactNode } from "react";
import { loadModelCatalog } from "../features/chat/services/modelCatalog";
import { preloadPanels } from "../shared/components/panelModules";

export function ModelCatalogLoader({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadModelCatalog().then(
      () => {
        if (active) setStatus("ready");
      },
      () => {
        if (active) setStatus("error");
      },
    );
    preloadPanels();
    return () => {
      active = false;
    };
  }, [attempt]);

  if (status === "loading") return null;
  if (status === "ready") return children;
  return (
    <main className="model-catalog-status">
      <div role="alert">
        <h1>Models couldn't be loaded</h1>
        <p>Check the BFF connection and try again. Your saved conversations haven't changed.</p>
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setAttempt((current) => current + 1);
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
