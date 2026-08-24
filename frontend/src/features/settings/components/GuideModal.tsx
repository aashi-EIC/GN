import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  HelpCircle,
  Info,
  Lightbulb,
  Sparkles,
  Target,
} from "lucide-react";
import type { ModelId } from "../../chat/types/semantic";
import { getModel } from "../../chat/utils/semantic";
import { Modal } from "../../../shared/components/Modal";

type GuideTab = "overview" | "prompts";

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
  const [activeTab, setActiveTab] = useState<GuideTab>("overview");

  return (
    <Modal close={close} label={`${activeModel.name} User Guide`}>
      <div className="guide-modal-container">
        {/* Header Hero Banner */}
        <div className="guide-modal-header">
          <div
            className="guide-modal-avatar"
            style={{ backgroundColor: activeModel.color || "#005D8F" }}
          >
            <span>{activeModel.short}</span>
          </div>
          <div className="guide-modal-header-info">
            <div className="guide-modal-header-title-row">
              <h2>{activeModel.name}</h2>
              {activeModel.nickname && (
                <span className="guide-modal-nickname-tag">{activeModel.nickname}</span>
              )}
            </div>
            <p className="guide-modal-subdescription">{activeModel.description}</p>
          </div>
        </div>

        {/* Key Highlights Metrics Grid */}
        {activeModel.highlights && activeModel.highlights.length > 0 && (
          <div className="guide-highlights-grid">
            {activeModel.highlights.map((item) => (
              <div key={item.label} className="guide-highlight-card">
                <span className="guide-highlight-label">{item.label}</span>
                <strong className="guide-highlight-value">{item.value}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="guide-tabs">
          <button
            type="button"
            className={`guide-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <BookOpen size={14} />
            <span>Executive Overview</span>
          </button>
          <button
            type="button"
            className={`guide-tab-btn ${activeTab === "prompts" ? "active" : ""}`}
            onClick={() => setActiveTab("prompts")}
          >
            <HelpCircle size={14} />
            <span>Suggested Prompts ({activeModel.prompts.length})</span>
          </button>
        </div>

        {/* Tab Content 1: Overview */}
        {activeTab === "overview" && (
          <div className="guide-tab-pane">
            {/* Overall Objective Card */}
            {activeModel.objective && (
              <div className="guide-card guide-objective-card-wrapper">
                <div className="guide-card-header">
                  <Target size={15} className="guide-card-icon" />
                  <span>Overall Objective</span>
                </div>

                <p className="guide-objective-lead">{activeModel.objective}</p>

                {activeModel.objectivePoints && activeModel.objectivePoints.length > 0 && (
                  <div className="guide-objective-grid">
                    {activeModel.objectivePoints.map((item) => (
                      <div key={item.label || item.text} className="guide-objective-card">
                        <div className="guide-objective-card-head">
                          {item.label && <span className="guide-objective-tag">{item.label}</span>}
                        </div>
                        <p className="guide-objective-card-text">{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeModel.objectiveNote && (
                  <div className="guide-objective-note-banner">
                    <Info size={14} className="guide-objective-note-icon" />
                    <span>{activeModel.objectiveNote}</span>
                  </div>
                )}
              </div>
            )}

            {/* Business Purpose Card */}
            {activeModel.businessPurpose && (
              <div className="guide-card">
                <div className="guide-card-header">
                  <Briefcase size={15} className="guide-card-icon" />
                  <span>Business Purpose & Value</span>
                </div>
                <p className="guide-card-text">{activeModel.businessPurpose}</p>
                {activeModel.businessPoints && activeModel.businessPoints.length > 0 && (
                  <ul className="guide-card-bullet-list">
                    {activeModel.businessPoints.map((point) => (
                      <li key={point}>
                        <CheckCircle2 size={14} className="guide-card-bullet-icon" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Quick Tip Banner */}
            {activeModel.quickTip && (
              <div className="guide-quick-tip">
                <Lightbulb size={16} className="guide-quick-tip-icon" />
                <div className="guide-quick-tip-content">
                  <strong>Quick Tip:</strong> {activeModel.quickTip}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Suggested Prompts */}
        {activeTab === "prompts" && (
          <div className="guide-tab-pane">
            <div className="guide-prompts-section">
              <div className="guide-prompts-header">
                <Sparkles size={15} className="guide-prompts-icon" />
                <span>Click any prompt below to run instant conversational BI analysis</span>
              </div>
              <div className="guide-prompt-grid">
                {activeModel.prompts.map((promptText) => (
                  <button
                    key={promptText}
                    type="button"
                    className="guide-prompt-card"
                    onClick={() => {
                      close();
                      onSelectPrompt?.(promptText);
                    }}
                  >
                    <div className="guide-prompt-card-left">
                      <Sparkles size={14} className="guide-prompt-card-icon" />
                      <span className="guide-prompt-card-text">{promptText}</span>
                    </div>
                    <ArrowRight size={14} className="guide-prompt-card-arrow" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
