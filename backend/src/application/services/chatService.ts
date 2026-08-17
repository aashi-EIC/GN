import { createAuthenticationProvider } from '../../integrations/mcp/authenticationProvider.js';
import { HttpMcpHostClient } from '../../integrations/mcp/httpMcpHostClient.js';
import { adaptMcpRequest } from '../../integrations/mcp/mcpRequestAdapter.js';
import { adaptMcpResponse } from '../../integrations/mcp/mcpResponseAdapter.js';
import { ensureOwnedSession, saveAssistantMessage } from '../../persistence/repositories/sessionRepository.js';
import { assertSafeText } from '../../security/contentSafety.js';
import type { AuthenticatedUser } from '../../types.js';

const client = new HttpMcpHostClient(createAuthenticationProvider());

type ChatInput = {
  prompt: string;
  sessionId: string;
  semanticModelId: string;
  correlationId: string;
  user: AuthenticatedUser;
  signal: AbortSignal;
};

export async function processChat(input: ChatInput) {
  assertSafeText(input.prompt, 'Prompt');

  const userMessageId = await ensureOwnedSession({
    id: input.sessionId,
    semanticModelId: input.semanticModelId,
    prompt: input.prompt,
    user: input.user,
    correlationId: input.correlationId,
  });

  const external = await client.send(adaptMcpRequest(input), input.user, input.correlationId, input.signal);
  const normalized = adaptMcpResponse(external);

  const messageId = await saveAssistantMessage(input.sessionId, input.correlationId, normalized);

  return {
    ...normalized,
    message_id: messageId,
    user_message_id: userMessageId,
  };
}
