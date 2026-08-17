import { Router } from 'express';
import { z } from 'zod';
import { getAccessibleModel, getFeatureFlags, listAccessibleModels } from '../../config/catalog.js';
import { config } from '../../config/env.js';
import { NotFoundError } from '../../errors.js';
import {
  createIssueReport,
  deleteMessageFeedback,
  saveMessageFeedback,
} from '../../persistence/repositories/interactionRepository.js';
import type { AuthenticatedRequest, AuthenticatedUser } from '../../types.js';

const modelParams = z.object({ modelId: z.string().trim().min(1).max(256) });
const messageParams = z.object({ messageId: z.string().uuid() });
const feedbackBody = z.object({
  rating: z.enum(['helpful', 'not_helpful']),
  reason: z.string().trim().min(1).max(2_000).optional(),
}).strict();
const issueBody = z.object({
  session_id: z.string().uuid().optional(),
  message_id: z.string().uuid().optional(),
  semantic_model_id: z.string().trim().min(1).max(256),
  category: z.string().trim().min(1).max(120),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().trim().min(12).max(10_000),
}).strict();

export const platformRouter = Router();

function permissionsFor(user: AuthenticatedUser) {
  return [
    'chat:create',
    'session:create',
    'session:read',
    'session:update',
    'session:delete',
    'feedback:create',
    'issue:create',
    ...(user.roles.some((role) => /admin|debug/i.test(role)) ? ['debug:read'] : []),
  ];
}

function userView(user: AuthenticatedUser) {
  return {
    id: user.objectId,
    tenant_id: user.tenantId,
    email: user.preferredUsername ?? null,
    roles: user.roles,
    scopes: user.scopes,
    permissions: permissionsFor(user),
    allowed_semantic_model_ids: listAccessibleModels(user).map((model) => model.id),
  };
}

platformRouter.get('/me', (request, res) => {
  const req = request as AuthenticatedRequest;
  res.json(userView(req.user));
});

platformRouter.get('/bootstrap', (request, res) => {
  const req = request as AuthenticatedRequest;
  res.json({
    user: userView(req.user),
    semantic_models: listAccessibleModels(req.user),
    features: getFeatureFlags(req.user),
    limits: {
      maximum_prompt_length: config.MAX_PROMPT_LENGTH,
      maximum_history_items: config.MAX_HISTORY_ITEMS,
    },
  });
});

platformRouter.get('/semantic-models', (request, res) => {
  const req = request as AuthenticatedRequest;
  res.json({ semantic_models: listAccessibleModels(req.user) });
});

platformRouter.get('/semantic-models/:modelId', (request, res) => {
  const req = request as unknown as AuthenticatedRequest;
  const { modelId } = modelParams.parse(req.params);
  const model = getAccessibleModel(req.user, modelId);
  if (!model) throw new NotFoundError('Semantic model catalogue is not configured');
  res.json({ semantic_model: model });
});

platformRouter.get('/semantic-models/:modelId/prompts', (request, res) => {
  const req = request as unknown as AuthenticatedRequest;
  const { modelId } = modelParams.parse(req.params);
  const model = getAccessibleModel(req.user, modelId);
  if (!model) throw new NotFoundError('Semantic model catalogue is not configured');
  res.json({
    semantic_model_id: model.id,
    prompts: model.examplePrompts.map((prompt, index) => ({
      id: `${model.id}-${index + 1}`,
      prompt,
    })),
  });
});

platformRouter.post('/messages/:messageId/feedback', async (request, res) => {
  const req = request as unknown as AuthenticatedRequest;
  const { messageId } = messageParams.parse(req.params);
  const body = feedbackBody.parse(req.body);
  const feedback = await saveMessageFeedback({
    messageId,
    rating: body.rating,
    ...(body.reason ? { reason: body.reason } : {}),
    user: req.user,
  });
  res.status(200).json({ feedback });
});

platformRouter.delete('/messages/:messageId/feedback', async (request, res) => {
  const req = request as unknown as AuthenticatedRequest;
  const { messageId } = messageParams.parse(req.params);
  await deleteMessageFeedback(req.user, messageId);
  res.status(204).end();
});

platformRouter.post('/issues', async (request, res) => {
  const req = request as AuthenticatedRequest;
  const body = issueBody.parse(req.body);
  getAccessibleModel(req.user, body.semantic_model_id);
  const issue = await createIssueReport({
    ...(body.session_id ? { sessionId: body.session_id } : {}),
    ...(body.message_id ? { messageId: body.message_id } : {}),
    semanticModelId: body.semantic_model_id,
    category: body.category,
    severity: body.severity,
    description: body.description,
    correlationId: req.correlationId,
    user: req.user,
  });
  res.status(201).json({ issue });
});
