import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getConversation } from '../api/conversations.js';
import { getDocuments as fetchDocuments } from '../api/documents.js';
import { buildChildrenMap, getActiveThread } from '../utils/messageTree.js';

/**
 * Load a conversation by ID, build the message tree, and return
 * the active thread.
 *
 * @param {string|null} conversationId
 * @returns {{
 *   messages: Array,
 *   setMessages: Function,
 *   activeLeafMessageId: string|null,
 *   setActiveLeafMessageId: Function,
 *   childrenMap: Map,
 *   activeThread: Array,
 *   title: string,
 *   setTitle: Function,
 *   isLoading: boolean,
 *   error: Error|null,
 *   markConversationLoaded: Function,
 * }}
 */
export function useConversation(conversationId) {
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [activeLeafMessageId, setActiveLeafMessageId] = useState(null);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tracks which conversation ID is currently loaded in memory
  const loadedConvIdRef = useRef(conversationId);

  const markConversationLoaded = useCallback((newId) => {
    loadedConvIdRef.current = newId;
  }, []);

  useEffect(() => {
    if (!conversationId || conversationId === 'new') {
      if (loadedConvIdRef.current !== 'new') {
        loadedConvIdRef.current = 'new';
        setMessages([]);
        setActiveLeafMessageId(null);
        setTitle('');
        setError(null);
      }
      return;
    }

    // If this conversation was just created in-memory by useStreaming or already active, skip re-fetching
    if (loadedConvIdRef.current === conversationId) {
      return;
    }

    loadedConvIdRef.current = conversationId;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Fire both requests in parallel
    Promise.all([
      getConversation(conversationId),
      fetchDocuments(conversationId).catch(() => []),
    ])
      .then(([conv]) => {
        if (cancelled) return;
        setMessages(conv.messages ?? []);
        setActiveLeafMessageId(conv.active_leaf_message_id ?? null);
        setTitle(conv.title ?? '');
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 403) {
          setError(
            new Error(
              'Session expired or access denied: This chat belongs to another user account.'
            )
          );
        } else if (err.status === 404) {
          setError(
            new Error('Conversation not found: This conversation does not exist or may have been deleted.')
          );
        } else if (!err.status) {
          toast.error('Could not reach the server. Is the backend running?');
          setError(new Error('Network error — backend unreachable'));
        } else {
          setError(err);
        }
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [conversationId, navigate]);

  // Derive childrenMap and activeThread from messages + activeLeafMessageId
  const childrenMap = buildChildrenMap(messages);
  const activeThread = getActiveThread(messages, activeLeafMessageId);

  return {
    messages,
    setMessages,
    activeLeafMessageId,
    setActiveLeafMessageId,
    childrenMap,
    activeThread,
    title,
    setTitle,
    isLoading,
    error,
    markConversationLoaded,
  };
}
