import { useEffect } from 'react';
import { MessageBubble } from './MessageBubble.jsx';
import { useAutoScroll } from '../../hooks/useAutoScroll.js';
import { Spinner } from '../ui/Spinner.jsx';
import styles from './MessageThread.module.css';

/**
 * Scrollable message thread.
 *
 * @param {{
 *   messages: Array,
 *   childrenMap: Map,
 *   isStreaming: boolean,
 *   isLoading: boolean,
 *   onEdit: Function,
 *   onRegenerate: Function,
 *   onRetry: Function,
 *   onBranchSwitch: Function,
 * }} props
 */
export function MessageThread({
  messages,
  childrenMap,
  isStreaming,
  isLoading,
  scrollRef: externalScrollRef,
  onEdit,
  onRegenerate,
  onRetry,
  onBranchSwitch,
}) {
  const internalAutoScroll = useAutoScroll();
  const scrollRef = externalScrollRef || internalAutoScroll.scrollRef;
  const scrollToBottom = internalAutoScroll.scrollToBottom;

  // Scroll to bottom when a new message is added
  useEffect(() => {
    if (!isStreaming) {
      scrollToBottom('smooth');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className={styles.centered}>
        <Spinner size={28} label="Loading conversation…" />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={styles.thread} role="log" aria-live="off" aria-label="Conversation messages">
      <div className={styles.inner}>
        {messages.map((message) => {
          const key = message.message_id ?? message.id ?? message.request_id;
          return (
            <MessageBubble
              key={key}
              message={message}
              childrenMap={childrenMap}
              isStreaming={isStreaming}
              onEdit={onEdit}
              onRegenerate={onRegenerate}
              onRetry={onRetry}
              onBranchSwitch={onBranchSwitch}
            />
          );
        })}
        {/* Bottom anchor for scroll */}
        <div className={styles.anchor} />
      </div>
    </div>
  );
}
