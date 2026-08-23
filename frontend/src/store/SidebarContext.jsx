import { createContext, useContext, useState, useCallback } from 'react';
import { getConversations, deleteConversation, updateConversation } from '../api/conversations.js';
import toast from 'react-hot-toast';

/**
 * SidebarContext — global conversation list (sidebar data source).
 *
 * Provides:
 *  - conversations: Array sorted by updated_at desc
 *  - loadConversations(): fetch list from API
 *  - addConversation(conv): optimistically add a new conversation
 *  - removeConversation(id): optimistically remove
 *  - renameConversation(id, title): optimistically rename
 *  - updateConversationTitle(id, title): quiet title swap after title generation
 */

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getConversations();
      setConversations(
        (data ?? []).map((c) => ({
          ...c,
          conversation_id: c.id ?? c.conversation_id,
        })),
      );
    } catch {
      // Non-fatal — sidebar stays empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Optimistically prepend a new conversation */
  const addConversation = useCallback((conv) => {
    const cid = conv.id ?? conv.conversation_id;
    setConversations((prev) => {
      // Avoid duplicates
      if (prev.some((c) => (c.id ?? c.conversation_id) === cid)) return prev;
      return [
        {
          ...conv,
          conversation_id: cid,
        },
        ...prev,
      ];
    });
  }, []);

  /** Optimistically remove a conversation row and call DELETE */
  const removeConversation = useCallback(async (conversationId) => {
    setConversations((prev) =>
      prev.filter((c) => (c.id ?? c.conversation_id) !== conversationId),
    );
    try {
      await deleteConversation(conversationId);
    } catch (err) {
      toast.error(`Failed to delete conversation: ${err.message}`);
      // Re-fetch to restore
      loadConversations();
    }
  }, [loadConversations]);

  /** Optimistically update a conversation title and call PATCH */
  const renameConversation = useCallback(async (conversationId, title) => {
    setConversations((prev) =>
      prev.map((c) =>
        (c.id ?? c.conversation_id) === conversationId ? { ...c, title } : c,
      ),
    );
    try {
      await updateConversation(conversationId, { title });
    } catch (err) {
      toast.error(`Failed to rename: ${err.message}`);
      loadConversations();
    }
  }, [loadConversations]);

  /** Quiet title swap after background title generation — no spinner, just text update */
  const updateConversationTitle = useCallback((conversationId, title) => {
    setConversations((prev) =>
      prev.map((c) =>
        (c.id ?? c.conversation_id) === conversationId ? { ...c, title } : c,
      ),
    );
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        conversations,
        isLoading,
        loadConversations,
        addConversation,
        removeConversation,
        renameConversation,
        updateConversationTitle,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
