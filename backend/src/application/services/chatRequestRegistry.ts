import type { AuthenticatedUser } from "../../types.js";

type ActiveRequest = {
  controller: AbortController;
  ownerTenantId: string;
  ownerObjectId: string;
};

const activeRequests = new Map<string, ActiveRequest>();

export function registerChatRequest(requestId: string, user: AuthenticatedUser) {
  const controller = new AbortController();
  activeRequests.set(requestId, {
    controller,
    ownerTenantId: user.tenantId,
    ownerObjectId: user.objectId,
  });
  return controller;
}

export function releaseChatRequest(requestId: string) {
  activeRequests.delete(requestId);
}

export function cancelChatRequest(requestId: string, user: AuthenticatedUser) {
  const active = activeRequests.get(requestId);
  if (!active || active.ownerTenantId !== user.tenantId || active.ownerObjectId !== user.objectId) {
    return false;
  }
  active.controller.abort(new Error("Request cancelled by user"));
  activeRequests.delete(requestId);
  return true;
}
