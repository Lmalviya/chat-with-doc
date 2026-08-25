import { apiJSON } from './client.js';

/**
 * GET /conversations/
 * Returns the sidebar list ordered by updated_at descending.
 *
 * @returns {Promise<Array<{conversation_id: string, id: string, title: string, created_at: string, updated_at: string}>>}
 */
export async function getConversations() {
  const data = await apiJSON('/conversations/');
  return (data ?? []).map((c) => ({
    ...c,
    conversation_id: c.id ?? c.conversation_id,
  }));
}

/**
 * POST /conversations/draft
 * Create an empty conversation in the database so documents can be attached before first message.
 *
 * @returns {Promise<{conversation_id: string, title: string, updated_at: string}>}
 */
export async function createDraftConversation() {
  const data = await apiJSON('/conversations/draft', { method: 'POST' });
  return {
    conversation_id: data.id,
    title: data.title || '',
    updated_at: data.updated_at,
  };
}

/**
 * GET /conversations/:id
 * Returns conversation metadata + all messages.
 *
 * @param {string} conversationId
 * @returns {Promise<{conversation_id: string, title: string, updated_at: string, messages: Array, active_leaf_message_id: string|null}>}
 */
export async function getConversation(conversationId) {
  const data = await apiJSON(`/conversations/${conversationId}`);
  const conv = data.conversation ?? data;
  const rawMessages = data.messages ?? [];

  const messages = rawMessages.map((m) => ({
    ...m,
    message_id: m.id ?? m.message_id,
    parent_message_id: m.parent_id ?? m.parent_message_id,
    conversation_id: m.conversation_id ?? conversationId,
  }));

  // Determine the default active leaf message (last message)
  const activeLeafId = messages.length > 0 ? messages[messages.length - 1].message_id : null;

  return {
    conversation_id: conv.id ?? conv.conversation_id ?? conversationId,
    title: conv.title ?? '',
    updated_at: conv.updated_at,
    messages,
    active_leaf_message_id: activeLeafId,
  };
}

/**
 * PATCH /conversations/:id
 * Update title.
 *
 * @param {string} conversationId
 * @param {{ title?: string }} data
 * @returns {Promise<any>}
 */
export async function updateConversation(conversationId, data) {
  return apiJSON(`/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: data.title }),
  });
}

/**
 * DELETE /conversations/:id
 * Hard-delete the conversation and all associated data.
 *
 * @param {string} conversationId
 * @returns {Promise<void>}
 */
export async function deleteConversation(conversationId) {
  return apiJSON(`/conversations/${conversationId}`, { method: 'DELETE' });
}

/**
 * POST /conversations/:id/title/generate
 * Generates and updates title in database based on initial message content.
 *
 * @param {string} conversationId
 * @param {string} content
 * @returns {Promise<{ title: string, conversation_id: string }>}
 */
export async function generateTitle(conversationId, content) {
  return apiJSON(`/conversations/${conversationId}/title/generate`, {
    method: 'POST',
    body: JSON.stringify({ content: content || '' }),
  });
}
