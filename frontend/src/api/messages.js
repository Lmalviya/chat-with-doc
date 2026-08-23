import { apiJSON } from './client.js';

/**
 * POST /conversations/:conversationId/messages/
 *
 * Appends a follow-up message to an existing conversation.
 *
 * @param {string} conversationId
 * @param {{ content: string, parent_message_id?: string, parent_id?: string }} payload
 * @param {string} [requestId] - X-Request-Id header value
 * @returns {Promise<any>}
 */
export async function sendMessage(conversationId, payload, requestId) {
  return apiJSON(`/conversations/${conversationId}/messages/`, {
    method: 'POST',
    requestId,
    body: JSON.stringify({
      content: payload.content,
      parent_id: payload.parent_message_id ?? payload.parent_id ?? null,
    }),
  });
}

/**
 * GET /conversations/:conversationId/messages/
 * Returns paginated message list for a conversation.
 *
 * @param {string} conversationId
 * @param {number} [limit=50]
 * @param {string|null} [beforeId=null]
 * @returns {Promise<Array>}
 */
export async function getMessages(conversationId, limit = 50, beforeId = null) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (beforeId) query.set('before_id', beforeId);
  const data = await apiJSON(`/conversations/${conversationId}/messages/?${query.toString()}`);
  return (data ?? []).map((m) => ({
    ...m,
    message_id: m.id ?? m.message_id,
    parent_message_id: m.parent_id ?? m.parent_message_id,
  }));
}
