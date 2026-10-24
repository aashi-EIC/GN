import { ChevronDown } from "lucide-react";
import { getSemanticModels } from "../utils/modelCatalog";
import type { ModelId } from "../types/semantic";
import { getModel } from "../utils/semantic";
import { Tooltip } from "../../../shared/components/Tooltip";

export function ModelPicker({
  modelId,
  setModelId,
  open,
  setOpen,
  compact = false,
  disabled = false,
  selectionRequired = false,
}: {
  modelId: ModelId;
  setModelId: (modelId: ModelId) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  compact?: boolean;
  disabled?: boolean;
  selectionRequired?: boolean;
}) {
  const currentModel = getModel(modelId);

  const pickerContent = (
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
        aria-label={
          disabled
            ? `Semantic model locked: ${currentModel.name}`
            : selectionRequired
              ? "Choose semantic model"
              : `Semantic model: ${currentModel.name}`
        }
      >
        <span className="model-chip" style={{ backgroundColor: currentModel.color }}>
          {selectionRequired ? "?" : currentModel.short}
        </span>
        {selectionRequired ? (
          <strong className="model-selected-name">Choose semantic model</strong>
        ) : compact ? (
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
          {getSemanticModels().map((model) => (
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

  if (disabled) {
    return (
      <Tooltip content="This model is locked because the chat has already started. You can change the model by adding a new chat.">
        {pickerContent}
      </Tooltip>
    );
  }

  return pickerContent;
}
