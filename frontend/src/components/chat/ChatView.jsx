import { useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { IconAlertTriangle, IconPlus, IconRefresh } from '@tabler/icons-react';
import { MessageThread } from './MessageThread.jsx';
import { InputBar } from '../input/InputBar.jsx';
import { useConversation } from '../../hooks/useConversation.js';
import { useStreaming } from '../../hooks/useStreaming.js';
import { useAutoScroll } from '../../hooks/useAutoScroll.js';
import { useSidebar } from '../../store/SidebarContext.jsx';
import styles from './ChatView.module.css';

/**
 * Active conversation view — route /c/:conversationId
 *
 * Responsibilities:
 *  1. Load conversation + build message tree (useConversation)
 *  2. Handle pending message from LandingView (router state)
 *  3. Stream responses (useStreaming)
 *  4. Render MessageThread + InputBar
 *  5. Coordinate branch switching, edit, regenerate
 */
export function ChatView() {
  const { conversationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addConversation, updateConversationTitle } = useSidebar();
  const { onNewContent, scrollRef } = useAutoScroll();
  const pendingConsumedRef = useRef(false);

  const {
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
  } = useConversation(conversationId);

  const isFirstExchange = messages.filter((m) => m.role === 'assistant').length === 0;

  const {
    isStreaming,
    startStream,
    stopStream,
    retryStream,
    switchMessageBranch,
  } = useStreaming({
    conversationId: conversationId === 'new' ? null : conversationId,
    messages,
    setMessages,
    setActiveLeafMessageId,
    activeLeafMessageId,
    onNewContent,
    isFirstExchange,
    onConversationCreated: (newConv) => {
      markConversationLoaded(newConv.id);
      addConversation(newConv);
    },
    onTitleGenerated: (newTitle, targetConvId) => {
      setTitle(newTitle);
      const effectiveId = targetConvId || (conversationId === 'new' ? null : conversationId);
      if (effectiveId) {
        updateConversationTitle(effectiveId, newTitle);
      }
    },
  });

  // Handle message passed from LandingView via router state exactly ONCE
  useEffect(() => {
    const pending = location.state?.pendingMessage;
    const requestId = location.state?.requestId;
    const isNew = location.state?.isNewConversation || conversationId === 'new';

    if (pending && requestId && !pendingConsumedRef.current && !isLoading) {
      pendingConsumedRef.current = true;
      // Clear history state immediately
      window.history.replaceState({}, '', location.pathname);

      startStream({
        content: pending,
        requestId,
        isNewConversation: isNew,
      });
    }
  }, [location.state, isLoading, startStream, conversationId]);

  // Regular send from this view
  const handleSend = useCallback((content) => {
    const requestId = crypto.randomUUID();
    startStream({
      content,
      requestId,
      isNewConversation: conversationId === 'new' || !conversationId,
    });
  }, [startStream, conversationId]);

  // Edit a user message — creates sibling branch
  const handleEdit = useCallback((message, newContent) => {
    const requestId = crypto.randomUUID();
    startStream({
      content: newContent,
      parentMessageId: message.parent_message_id ?? message.parent_id,
      requestId,
    });
  }, [startStream]);

  // Regenerate an assistant message
  const handleRegenerate = useCallback((message) => {
    const requestId = crypto.randomUUID();
    startStream({
      content: '', // backend will use history
      parentMessageId: message.parent_message_id ?? message.parent_id,
      requestId,
    });
  }, [startStream]);

  if (error) {
    return (
      <div className={styles.view}>
        <div className={styles.errorState}>
          <div className={styles.errorIconWrapper}>
            <IconAlertTriangle size={32} stroke={1.5} className={styles.errorAlertIcon} />
          </div>
          <h2 className={styles.errorHeading}>Conversation Inaccessible</h2>
          <p className={styles.errorBody}>{error.message}</p>
          <div className={styles.errorActions}>
            <button
              className={styles.primaryActionBtn}
              onClick={() => navigate('/')}
              aria-label="Start a new chat"
            >
              <IconPlus size={16} stroke={2} />
              <span>Start New Chat</span>
            </button>
            <button
              className={styles.secondaryActionBtn}
              onClick={() => window.location.reload()}
              aria-label="Retry loading conversation"
            >
              <IconRefresh size={15} stroke={1.75} />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.view}>
      <MessageThread
        messages={activeThread}
        childrenMap={childrenMap}
        isStreaming={isStreaming}
        isLoading={isLoading}
        scrollRef={scrollRef}
        onEdit={handleEdit}
        onRegenerate={handleRegenerate}
        onRetry={retryStream}
        onBranchSwitch={switchMessageBranch}
      />
      <InputBar
        conversationId={conversationId === 'new' ? null : conversationId}
        isStreaming={isStreaming}
        onSend={handleSend}
        onStop={stopStream}
      />
    </div>
  );
}
