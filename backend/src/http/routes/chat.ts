import { Router } from "express";
import { z } from "zod";
import {
  cancelChatRequest,
  registerChatRequest,
  releaseChatRequest,
} from "../../application/services/chatRequestRegistry.js";
import { processChat } from "../../application/services/chatService.js";
import { getAccessibleModel, getFeatureFlags } from "../../config/catalog.js";
import { config } from "../../config/env.js";
import { NotFoundError } from "../../errors.js";
import {
  createOwnedSession,
  deleteOwnedSession,
  getOwnedSession,
  listOwnedSessions,
  renameOwnedSession,
} from "../../persistence/repositories/sessionRepository.js";
import type { AuthenticatedRequest } from "../../types.js";
import { rateLimit } from "../middleware/rateLimit.js";

const chatBody = z
  .object({
    session_id: z.string().uuid(),
    semantic_model_id: z.string().trim().min(1).max(256),
    prompt: z.string().trim().min(1).max(config.MAX_PROMPT_LENGTH),
    debug: z.boolean().optional(),
  })
  .strict();

const createSessionBody = z
  .object({
    semantic_model_id: z.string().trim().min(1).max(256),
    title: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const updateSessionBody = z
  .object({
    title: z.string().trim().min(1).max(120),
  })
  .strict();

const sessionParams = z.object({ sessionId: z.string().uuid() });
const requestParams = z.object({ requestId: z.string().trim().min(1).max(128) });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(Math.min(config.MAX_HISTORY_ITEMS, 50)),
  cursor: z.string().datetime({ offset: true }).optional(),
  search: z.string().trim().min(1).max(160).optional(),
  semantic_model_id: z.string().trim().min(1).max(256).optional(),
});

export const chatRouter = Router();

chatRouter.post("/sessions", async (request, res) => {
  const req = request as AuthenticatedRequest;
  const body = createSessionBody.parse(req.body);
  getAccessibleModel(req.user, body.semantic_model_id);
  const session = await createOwnedSession({
    semanticModelId: body.semantic_model_id,
    title: body.title ?? "New conversation",
    user: req.user,
  });
  res.status(201).json({ session });
});

chatRouter.get("/sessions", async (request, res) => {
  const req = request as AuthenticatedRequest;
  const query = listQuery.parse(req.query);
  if (query.semantic_model_id) getAccessibleModel(req.user, query.semantic_model_id);
  res.json(
    await listOwnedSessions({
      user: req.user,
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.semantic_model_id ? { semanticModelId: query.semantic_model_id } : {}),
    }),
  );
});

chatRouter.get("/sessions/:sessionId", async (request, res) => {
  const req = request as unknown as AuthenticatedRequest;
  const { sessionId } = sessionParams.parse(req.params);
  res.json(await getOwnedSession(req.user, sessionId));
});

chatRouter.patch("/sessions/:sessionId", async (request, res) => {
  const req = request as unknown as AuthenticatedRequest;
  const { sessionId } = sessionParams.parse(req.params);
  const { title } = updateSessionBody.parse(req.body);
  res.json({ session: await renameOwnedSession(req.user, sessionId, title) });
});

chatRouter.delete("/sessions/:sessionId", async (request, res) => {
  const req = request as unknown as AuthenticatedRequest;
  const { sessionId } = sessionParams.parse(req.params);
  await deleteOwnedSession(req.user, sessionId);
  res.status(204).end();
});

chatRouter.post("/chat/:requestId/cancel", async (request, res) => {
  const req = request as unknown as AuthenticatedRequest;
  const { requestId } = requestParams.parse(req.params);
  if (!cancelChatRequest(requestId, req.user)) throw new NotFoundError("Active request not found");
  res.status(202).json({ request_id: requestId, status: "cancelling" });
});

chatRouter.post("/chat", rateLimit, async (request, res) => {
  const req = request as AuthenticatedRequest;
  const body = chatBody.parse(req.body);
  getAccessibleModel(req.user, body.semantic_model_id);

  const controller = registerChatRequest(req.correlationId, req.user);
  const signal = AbortSignal.any([req.requestSignal, controller.signal]);
  try {
    const includeDebug =
      body.debug === true &&
      (config.NODE_ENV !== "production" || getFeatureFlags(req.user).debugMode);
    const result = await processChat({
      prompt: body.prompt,
      sessionId: body.session_id,
      semanticModelId: body.semantic_model_id,
      correlationId: req.correlationId,
      user: req.user,
      signal,
      includeDebug,
    });
    const debug = "debug" in result ? result.debug : undefined;
    const publicResult = {
      answer: result.answer,
      message_id: result.message_id,
      user_message_id: result.user_message_id,
    };
    const response = { ...publicResult, request_id: req.correlationId };
    res.status(200).json(
      debug
        ? {
            ...response,
            debug: {
              ...debug,
              bff_response: response,
            },
          }
        : response,
    );
  } finally {
    releaseChatRequest(req.correlationId);
  }
});
