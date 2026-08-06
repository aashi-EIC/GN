import { HelpCircle } from "lucide-react";
import { useState } from "react";
import type { ModelId } from "../../features/chat/types/semantic";
import { getModel } from "../../features/chat/utils/semantic";
import { IconButton } from "./ui/IconButton";

export function Navbar({
  modelId,
  openGuide,
}: {
  modelId?: ModelId;
  openGuide: () => void;
  sidebarOpen?: boolean;
}) {
  const [guideHovered, setGuideHovered] = useState(false);
  const activeModel = getModel(modelId ?? "metadata_stats_linear");

  return (
    <header className="topbar">
      <div className="topbar-left" />

      <div className="header-actions">
        <div
          className="guide-button-wrap"
          onMouseEnter={() => setGuideHovered(true)}
          onMouseLeave={() => setGuideHovered(false)}
        >
          <IconButton
            label={`User Guide for ${activeModel.name}`}
            className="model-guide-button"
            onClick={() => {
              setGuideHovered(!guideHovered);
              openGuide();
            }}
          >
            <HelpCircle />
          </IconButton>
          {guideHovered && (
            <div className="header-guide-popover">
              <div className="guide-popover-head">
                <span className="model-chip" style={{ backgroundColor: activeModel.color }}>
                  {activeModel.short}
                </span>
                <div>
                  <strong>{activeModel.name}</strong>
                  {activeModel.nickname && <small>{activeModel.nickname}</small>}
                </div>
              </div>
              <p className="guide-popover-desc">{activeModel.guide ?? activeModel.description}</p>
              <div className="guide-popover-prompts">
                <b>Try asking:</b>
                <ul>
                  {activeModel.prompts.map((prompt) => (
                    <li key={prompt}>{prompt}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


