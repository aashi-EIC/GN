import { SlidersHorizontal, Sparkles } from "lucide-react";
import type { ModelId } from "../../chat/types/semantic";
import { getModel } from "../../chat/utils/semantic";
import { Modal } from "../../../shared/components/Modal";

export function GuideModal({
  close,
  modelId,
  onSelectPrompt,
}: {
  close: () => void;
  modelId: ModelId;
  onSelectPrompt?: (prompt: string) => void;
}) {
  const activeModel = getModel(modelId);

  return (
    <Modal close={close} label={`${activeModel.name} guide`}>
      <span className="modal-icon gn-prompt-modal-icon">
        <SlidersHorizontal />
      </span>
      <h2>{activeModel.name} Guide & Prompts</h2>
      <div className="guide-current">
        <span className="model-chip" style={{ backgroundColor: activeModel.color }}>
          {activeModel.short}
        </span>
        <div>
          <b>{activeModel.name}</b>
          <p>{activeModel.description}</p>
        </div>
      </div>
      <p>{activeModel.guide}</p>
      <div className="guide-prompts">
        <b>Suggested prompts (click to start chat):</b>
        <div className="guide-prompt-list">
          {activeModel.prompts.map((promptText) => (
            <button
              key={promptText}
              type="button"
              className="guide-prompt-btn"
              onClick={() => {
                close();
                onSelectPrompt?.(promptText);
              }}
            >
              <Sparkles className="guide-prompt-btn-icon" />
              <span>{promptText}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}


