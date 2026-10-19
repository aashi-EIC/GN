import { Router } from "express";
import { once } from "node:events";
import { z } from "zod";
import {
  cancelChatRequest,
  registerChatRequest,
  releaseChatRequest,
} from "../../application/services/chatRequestRegistry.js";
import { processChat } from "../../application/services/chatService.js";
import { getAccessibleModel, getFeatureFlags } from "../../config/catalog.js";
import { config } from "../../config/env.js";
import { AppError, NotFoundError, UnsafeContentError } from "../../errors.js";
import { logger } from "../../observability/logger.js";
import {
  createOwnedSession,
  deleteOwnedSession,
  getOwnedSession,
  listOwnedSessions,
  renameOwnedSession,
} from "../../persistence/repositories/sessionRepository.js";
import type { AuthenticatedRequest } from "../../types.js";

const chatBody = z
  .object({
    browser_user_id: z.string().uuid().optional(),
    session_id: z.string().uuid(),
    mcp_session_id: z.string().trim().min(1).max(256).optional(),
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

chatRouter.get("/chat/capabilities", (_request, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ streaming: config.CHAT_STREAMING_ENABLED });
});

chatRouter.post("/chat/stream", async (request, res) => {
  if (!config.CHAT_STREAMING_ENABLED) throw new NotFoundError("Chat streaming is disabled");
  const req = request as AuthenticatedRequest;
  const body = chatBody.parse(req.body);
  getAccessibleModel(req.user, body.semantic_model_id);
  const controller = registerChatRequest(req.correlationId, req.user);
  const signal = AbortSignal.any([
    req.requestSignal,
    controller.signal,
    AbortSignal.timeout(config.MCP_TIMEOUT_MS + 5_000),
  ]);
  const emit = async (event: string, data: unknown) => {
    signal.throwIfAborted();
    if (!res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) {
      await once(res, "drain", { signal });
    }
  };
  res.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded && !res.writableNeedDrain)
      res.write(": heartbeat\n\n");
  }, 15_000);
  heartbeat.unref();
  try {
    await emit("status", { message: "Analyzing your data" });
    const result = await processChat(
      {
        prompt: body.prompt,
        browserUserId: body.browser_user_id ?? body.session_id,
        sessionId: body.session_id,
        ...(body.mcp_session_id ? { mcpSessionId: body.mcp_session_id } : {}),
        semanticModelId: body.semantic_model_id,
        correlationId: req.correlationId,
        user: req.user,
        signal,
        includeDebug: config.NODE_ENV !== "production" || getFeatureFlags(req.user).debugMode,
      },
      (progress) => emit(progress.event, progress.data),
    );
    const response = {
      answer: { text: result.answer.text },
      message_id: result.message_id,
      user_message_id: result.user_message_id,
      request_id: req.correlationId,
      ...(result.mcp_session_id ? { mcp_session_id: result.mcp_session_id } : {}),
      ...(result.mcp_session ? { mcp_session: result.mcp_session } : {}),
    };
    const debug = "debug" in result ? result.debug : undefined;
    await emit(
      "complete",
      debug ? { ...response, debug: { ...debug, bff_response: response } } : response,
    );
  } catch (error) {
    const code = error instanceof AppError ? error.code : "STREAM_ERROR";
    const message =
      error instanceof UnsafeContentError
        ? error.message
        : "The analytics engine was unable to process this request. Please try asking a metric question for your selected model or rephrase your prompt.";
    logger.warn(
      {
        correlationId: req.correlationId,
        code,
        error: error instanceof Error ? error.message : String(error),
      },
      "Chat stream did not complete",
    );
    if (!signal.aborted && !res.destroyed) {
      await emit("error", {
        error: { code, message },
      }).catch(() => undefined);
    }
  } finally {
    clearInterval(heartbeat);
    releaseChatRequest(req.correlationId);
    res.end();
  }
});

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

chatRouter.post("/chat", async (request, res) => {
  const req = request as AuthenticatedRequest;
  const body = chatBody.parse(req.body);
  getAccessibleModel(req.user, body.semantic_model_id);

  const controller = registerChatRequest(req.correlationId, req.user);
  const signal = AbortSignal.any([req.requestSignal, controller.signal]);
  try {
    const includeDebug = config.NODE_ENV !== "production" || getFeatureFlags(req.user).debugMode;
    const result = await processChat({
      prompt: body.prompt,
      browserUserId: body.browser_user_id ?? body.session_id,
      sessionId: body.session_id,
      ...(body.mcp_session_id ? { mcpSessionId: body.mcp_session_id } : {}),
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
      ...(result.mcp_session_id ? { mcp_session_id: result.mcp_session_id } : {}),
      ...(result.mcp_session ? { mcp_session: result.mcp_session } : {}),
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
