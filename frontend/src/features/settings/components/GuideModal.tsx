import { BookOpen } from "lucide-react";
import type { ModelId } from "../../chat/types/semantic";
import { getModel } from "../../chat/utils/semantic";
import { Modal } from "../../../shared/components/Modal";

export function GuideModal({ close, modelId }: { close: () => void; modelId: ModelId }) {
  const activeModel = getModel(modelId);

  return (
    <Modal close={close}>
      <span className="modal-icon">
        <BookOpen />
      </span>
      <h2>{activeModel.name} guide</h2>
      <div className="guide-current">
        <span className="model-chip" style={{ backgroundColor: activeModel.color }}>{activeModel.short}</span>
        <div>
          <b>{activeModel.name}</b>
          <p>{activeModel.description}</p>
        </div>
      </div>
      <p>{activeModel.guide}</p>
      <div className="guide-prompts">
        <b>Try asking</b>
        <ul>
          {activeModel.prompts.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
