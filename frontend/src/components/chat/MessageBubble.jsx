import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { MESSAGE_STATUS } from '../../utils/constants.js';
import { StreamingCursor } from './StreamingCursor.jsx';
import { SourcesRow } from './SourcesRow.jsx';
import { MessageActions } from './MessageActions.jsx';
import { BranchSwitcher } from './BranchSwitcher.jsx';
import { InlineEditor } from './InlineEditor.jsx';
import { PipelineStatus } from './PipelineStatus.jsx';
import { ThinkingDropdown } from './ThinkingDropdown.jsx';
import styles from './MessageBubble.module.css';

/**
 * Single message bubble (user or assistant).
 *
 * @param {{
 *   message: Object,
 *   childrenMap: Map,
 *   isStreaming: boolean,
 *   onEdit: (message: Object, newContent: string) => void,
 *   onRegenerate: (message: Object) => void,
 *   onRetry: (message: Object) => void,
 *   onBranchSwitch: (direction: string, message: Object) => void,
 * }} props
 */
export function MessageBubble({
  message,
  childrenMap,
  isStreaming,
  onEdit,
  onRegenerate,
  onRetry,
  onBranchSwitch,
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isCurrentlyStreaming = message.status === MESSAGE_STATUS.STREAMING;
  const isStopped = message.status === MESSAGE_STATUS.STOPPED;
  const isFailed = message.status === MESSAGE_STATUS.FAILED;

  function handleSaveEdit(newContent) {
    setEditing(false);
    onEdit(message, newContent);
  }

  function handleCancelEdit() {
    setEditing(false);
  }

  const showDevTrace =
    import.meta.env.VITE_DEV_TRACE === 'true' && isAssistant && message.request_id;

  return (
    <div
      className={`${styles.wrapper} ${isUser ? styles.user : styles.assistant} animate-slide-up`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {editing ? (
        /* Inline editor replaces the bubble */
        <div className={styles.editorWrapper}>
          <InlineEditor
            initialContent={message.content}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        </div>
      ) : (
        <div className={styles.bubble}>
          {/* Live Pipeline Status during initial analysis/retrieval */}
          {isAssistant && isCurrentlyStreaming && (message.currentStage || (!message.content && !message.thinking)) && (
            <PipelineStatus
              stageText={message.currentStage || 'Processing query...'}
              stages={message.stages}
            />
          )}

          {/* Collapsible reasoning/thought process (visible during and after streaming) */}
          {isAssistant && Boolean(message.thinking) && (
            <ThinkingDropdown
              thinking={message.thinking}
              isStreaming={isCurrentlyStreaming}
              thinkingDone={message.thinkingDone}
              elapsedMs={message.thinkingElapsedMs}
            />
          )}

          {/* Message content */}
          <div
            className={isAssistant ? 'prose' : styles.userText}
            aria-live={isCurrentlyStreaming ? 'polite' : 'off'}
          >
            {isAssistant ? (
              <>
                {Boolean(message.content) && (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                )}
                {isCurrentlyStreaming && !message.content && !message.thinking && !message.currentStage && (
                  <StreamingCursor />
                )}
                {isCurrentlyStreaming && Boolean(message.content) && <StreamingCursor />}
              </>
            ) : (
              /* User messages: escaped text, no markdown */
              <p>{message.content}</p>
            )}
          </div>

          {/* Stopped badge */}
          {isStopped && (
            <p className={styles.stoppedBadge} aria-label="Generation stopped">
              Generation stopped
            </p>
          )}

          {/* Network error + retry */}
          {isFailed && (
            <div className={styles.errorRow}>
              <IconAlertCircle size={14} className={styles.errorIcon} />
              <span className={styles.errorText}>Failed to generate response.</span>
              <button
                className={styles.retryBtn}
                onClick={() => onRetry(message)}
                aria-label="Retry generation"
              >
                <IconRefresh size={13} />
                Retry
              </button>
            </div>
          )}

          {/* Sources (assistant only, complete status) */}
          {isAssistant && message.status === MESSAGE_STATUS.COMPLETE && (
            <SourcesRow sources={message.sources} />
          )}

          {/* Dev-only LangSmith trace link */}
          {showDevTrace && (
            <a
              className={styles.traceLink}
              href={`https://smith.langchain.com/trace/${message.request_id}`}
              target="_blank"
              rel="noreferrer"
              aria-label="View LangSmith trace"
            >
              view trace ↗
            </a>
          )}
        </div>
      )}

      {/* Actions + branch switcher row — shown on hover for complete messages */}
      {!editing && !isCurrentlyStreaming && (
        <div className={`${styles.meta} ${hovered ? styles.metaVisible : ''}`}>
          <BranchSwitcher
            message={message}
            childrenMap={childrenMap}
            onSwitch={onBranchSwitch}
          />
          <MessageActions
            message={message}
            isStreaming={isStreaming}
            onEdit={() => setEditing(true)}
            onRegenerate={() => onRegenerate(message)}
          />
        </div>
      )}
    </div>
  );
}
