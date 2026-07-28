import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from '../middleware/rateLimit.js';
import { getOwnedSession, listOwnedSessions } from '../../persistence/repositories/sessionRepository.js';
import { processChat } from '../../application/services/chatService.js';
import type { AuthenticatedRequest } from '../../types.js';

const chatBody = z.object({
  session_id: z.string().uuid(),
  semantic_model_id: z.string().trim().min(1).max(256),
  prompt: z.string().trim().min(1).max(20_000),
}).strict();

const sessionParams = z.object({ sessionId: z.string().uuid() });
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(10).default(10) });

export const chatRouter = Router();

chatRouter.get('/sessions', async (request, res) => {
  const req = request as AuthenticatedRequest;
  const query = listQuery.parse(req.query);
  const sessions = await listOwnedSessions(req.user, query.limit);

  res.json({ sessions });
});

chatRouter.get('/sessions/:sessionId', async (request, res) => {
  const req = request as unknown as AuthenticatedRequest;
  const { sessionId } = sessionParams.parse(req.params);

  res.json(await getOwnedSession(req.user, sessionId));
});

chatRouter.post('/chat', rateLimit, async (request, res) => {
  const req = request as AuthenticatedRequest;
  const body = chatBody.parse(req.body);

  const result = await processChat({
    prompt: body.prompt,
    sessionId: body.session_id,
    semanticModelId: body.semantic_model_id,
    correlationId: req.correlationId,
    user: req.user,
    signal: req.requestSignal,
  });

  res.status(200).json(result);
});
