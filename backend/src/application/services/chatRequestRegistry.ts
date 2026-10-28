import type { AuthenticatedUser } from "../../types.js";
import { ConflictError } from "../../errors.js";

type ActiveRequest = {
  controller: AbortController;
  ownerTenantId: string;
  ownerObjectId: string;
};

const activeRequests = new Map<string, ActiveRequest>();

export function registerChatRequest(requestId: string, user: AuthenticatedUser) {
  if (activeRequests.has(requestId))
    throw new ConflictError("A request with this correlation ID is already running");
  const controller = new AbortController();
  activeRequests.set(requestId, {
    controller,
    ownerTenantId: user.tenantId,
    ownerObjectId: user.objectId,
  });
  return controller;
}

export function releaseChatRequest(requestId: string, controller: AbortController) {
  if (activeRequests.get(requestId)?.controller === controller) activeRequests.delete(requestId);
}

export function cancelChatRequest(requestId: string, user: AuthenticatedUser) {
  const active = activeRequests.get(requestId);
  if (
    !active ||
    active.controller.signal.aborted ||
    active.ownerTenantId !== user.tenantId ||
    active.ownerObjectId !== user.objectId
  ) {
    return false;
  }
  active.controller.abort(new Error("Request cancelled by user"));
  return true;
}
