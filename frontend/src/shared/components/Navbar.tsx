import { SlidersHorizontal } from "lucide-react";
import type { ModelId } from "../../features/chat/types/semantic";
import { getModel } from "../../features/chat/utils/semantic";
import { IconButton } from "./ui/IconButton";

export function Navbar({
  modelId,
  openGuide,
}: {
  modelId?: ModelId;
  openGuide: () => void;
  conversationTitle?: string;
  sidebarOpen?: boolean;
  onSelectPrompt?: (prompt: string) => void;
}) {
  const activeModel = getModel(modelId ?? "schedule_completeness_tsg");

  return (
    <header className="topbar">
      <div className="topbar-left" />

      <div className="header-actions">
        <div className="guide-button-wrap">
          <IconButton
            label={`Prompts & Guide for ${activeModel.name}`}
            className="model-guide-button"
            onClick={openGuide}
          >
            <SlidersHorizontal className="gn-prompt-icon" />
          </IconButton>
        </div>
      </div>
    </header>
  );
}



