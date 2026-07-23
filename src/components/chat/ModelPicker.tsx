import { ChevronDown } from "lucide-react";
import { semanticModels } from "../../constants/semanticModels";
import type { ModelId } from "../../types/semantic";
import { getModel } from "../../utils/semantic";

export function ModelPicker({
  modelId,
  setModelId,
  open,
  setOpen,
  compact = false,
  disabled = false,
}: {
  modelId: ModelId;
  setModelId: (modelId: ModelId) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const currentModel = getModel(modelId);

  return (
    <div className={`model-picker ${compact ? "compact" : ""} ${disabled ? "locked" : ""}`}>
      <button
        onClick={() => {
          if (disabled) {
            return;
          }
          setOpen(!open);
        }}
        type="button"
        disabled={disabled}
        aria-expanded={disabled ? false : open}
        title={
          disabled
            ? "Start a new chat to change the semantic model"
            : `Semantic model: ${currentModel.name}`
        }
        aria-label={
          disabled
            ? `Semantic model locked: ${currentModel.name}`
            : `Semantic model: ${currentModel.name}`
        }
      >
        <span className="model-chip" style={{ backgroundColor: currentModel.color }}>
          {currentModel.short}
        </span>
        {compact ? (
          <strong className="model-selected-name">{currentModel.name}</strong>
        ) : (
          <div>
            <small>Semantic model</small>
            {currentModel.name}
          </div>
        )}
        <ChevronDown />
      </button>
      {open && !disabled && (
        <div className="model-menu">
          {semanticModels.map((model) => (
            <button
              key={model.id}
              className={model.id === modelId ? "selected" : ""}
              onClick={() => {
                setModelId(model.id);
                setOpen(false);
              }}
              type="button"
            >
              <span className="model-menu-text">{model.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
