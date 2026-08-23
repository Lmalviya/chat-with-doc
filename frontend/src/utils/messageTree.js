/**
 * Message tree utilities — all branch logic lives here.
 *
 * DB field names supported:
 *  message_id / id, parent_message_id / parent_id, conversation_id,
 *  role, content, status, request_id, created_at
 */

/**
 * Build a Map: parentKey → sorted Message[]
 * Root messages (parent_message_id = null) are keyed under '__root__'.
 *
 * @param {Array} messages - flat array of message objects from the API
 * @returns {Map<string, Array>}
 */
export function buildChildrenMap(messages) {
  const map = new Map();

  for (const msg of messages) {
    const key = msg.parent_message_id ?? msg.parent_id ?? '__root__';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(msg);
  }

  // Sort each sibling group by created_at ascending so oldest = first
  for (const [, siblings] of map) {
    siblings.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  }

  return map;
}

/**
 * Walk backward from activeLeafMessageId through parent_message_id chain to root.
 * Returns the active thread ordered [root, ..., leaf].
 *
 * @param {Array} messages
 * @param {string|null} activeLeafMessageId
 * @returns {Array}
 */
export function getActiveThread(messages, activeLeafMessageId) {
  if (!messages || !messages.length) return [];

  const byId = new Map();
  for (const m of messages) {
    const id = m.message_id ?? m.id;
    if (id) byId.set(id, m);
  }

  let currentId = activeLeafMessageId;
  if (!currentId || !byId.has(currentId)) {
    // Fallback: pick the last message in array
    const last = messages[messages.length - 1];
    currentId = last?.message_id ?? last?.id;
  }

  if (!currentId || !byId.has(currentId)) {
    // Safe fallback to returning all messages in order
    return messages;
  }

  const thread = [];
  const visited = new Set();
  let current = byId.get(currentId);

  while (current) {
    const id = current.message_id ?? current.id;
    if (!id || visited.has(id)) break;
    visited.add(id);

    thread.unshift(current);
    const parentId = current.parent_message_id ?? current.parent_id;
    current = parentId ? byId.get(parentId) : null;
  }

  return thread.length ? thread : messages;
}

/**
 * Get all siblings of a message (messages that share the same parent).
 * Returns { siblings, currentIndex }.
 *
 * @param {Object} message
 * @param {Map} childrenMap - from buildChildrenMap()
 * @returns {{ siblings: Array, currentIndex: number }}
 */
export function getSiblings(message, childrenMap) {
  const parentKey = message.parent_message_id ?? message.parent_id ?? '__root__';
  const siblings = childrenMap.get(parentKey) ?? [];
  const msgId = message.message_id ?? message.id;
  const currentIndex = siblings.findIndex((s) => (s.message_id ?? s.id) === msgId);
  return { siblings, currentIndex };
}

/**
 * From a given node, follow the most-recent-child chain to find the leaf.
 * Used when switching branches to determine the new activeLeafMessageId.
 *
 * @param {string} nodeId - message_id to start from
 * @param {Map} childrenMap
 * @returns {string} leaf message_id
 */
export function getLeafFromNode(nodeId, childrenMap) {
  let currentId = nodeId;

  // Cap iterations to prevent infinite loops on malformed data
  const MAX_DEPTH = 200;
  let depth = 0;

  while (childrenMap.has(currentId) && depth < MAX_DEPTH) {
    const children = childrenMap.get(currentId);
    if (!children || !children.length) break;
    // Pick the most recently created child
    const child = children[children.length - 1];
    currentId = child.message_id ?? child.id;
    depth++;
  }

  return currentId;
}

/**
 * Switch to a sibling branch and return the new activeLeafMessageId.
 *
 * @param {'prev'|'next'} direction
 * @param {Object} message - the branched message (the one showing the switcher)
 * @param {Map} childrenMap
 * @returns {string|null} new activeLeafMessageId, or null if no switch possible
 */
export function switchBranch(direction, message, childrenMap) {
  const { siblings, currentIndex } = getSiblings(message, childrenMap);

  if (siblings.length <= 1) return null;

  const nextIndex =
    direction === 'next'
      ? (currentIndex + 1) % siblings.length
      : (currentIndex - 1 + siblings.length) % siblings.length;

  const targetSibling = siblings[nextIndex];
  const targetId = targetSibling.message_id ?? targetSibling.id;
  return getLeafFromNode(targetId, childrenMap);
}

/**
 * Count how many sibling groups exist in the entire message set.
 * Used to decide if branch switchers should be shown at all.
 *
 * @param {Map} childrenMap
 * @returns {boolean}
 */
export function hasBranches(childrenMap) {
  for (const [, children] of childrenMap) {
    if (children.length > 1) return true;
  }
  return false;
}
