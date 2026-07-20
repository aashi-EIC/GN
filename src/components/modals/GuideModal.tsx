import { BookOpen } from "lucide-react";
import { semanticModels } from "../../constants/semanticModels";
import type { ModelId } from "../../types/semantic";
import { getModel } from "../../utils/semantic";
import { Modal } from "./Modal";

export function GuideModal({ close, modelId }: { close: () => void; modelId: ModelId }) {
  const activeModel = getModel(modelId);

  return (
    <Modal close={close}>
      <span className="modal-icon">
        <BookOpen />
      </span>
      <h2>User guide</h2>
      <p>{activeModel.guide}</p>
      <div className="guide-current">
        <span style={{ backgroundColor: activeModel.color }}>{activeModel.short}</span>
        <div>
          <b>{activeModel.name}</b>
          <p>{activeModel.description}</p>
        </div>
      </div>
      <div className="guide-list">
        {semanticModels.map((model) => (
          <div className="guide-model" key={model.id}>
            <span style={{ backgroundColor: model.color }}>{model.short}</span>
            <div>
              <b>{model.name}</b>
              <p>{model.description}</p>
              <small>{model.prompts.join(" / ")}</small>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
