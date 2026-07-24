import { Check, HelpCircle } from "lucide-react";
import type { ModelId } from "../../types/semantic";
import { getModel } from "../../utils/semantic";
import { Modal } from "./Modal";

export function TourModal({ close, modelId }: { close: () => void; modelId: ModelId }) {
  const model = getModel(modelId);

  return (
    <Modal close={close}>
      <span className="modal-icon">
        <HelpCircle />
      </span>
      <h2>Application tour</h2>
      <p>
        The workspace opens with a centered prompt. Once you send a message, the chat composer moves
        to the bottom and keeps the semantic model selector attached.
      </p>
      <div className="tour-list">
        <div>
          <b>Semantic model dropdown</b>
          <p>{model.guide}</p>
        </div>
        <div>
          <b>Last 10 sessions/chats</b>
          <p>Use the left panel to start a new chat or reopen one of the 10 most recent chats.</p>
        </div>
        <div>
          <b>Example prompts</b>
          <p>{model.prompts.join(" / ")}</p>
        </div>
        <div>
          <b>Admin and support</b>
          <p>Use Debug to inspect MCP payloads and Report errors to save a traceable issue.</p>
        </div>
      </div>
      <div className="modal-actions">
        <button className="primary-action" onClick={close} type="button">
          <Check />
          Start using Gracenote Conversational BI
        </button>
      </div>
    </Modal>
  );
}
