import { useState, useCallback } from 'react';
import { IconCopy, IconPencil, IconRefresh, IconCheck } from '@tabler/icons-react';
import { Tooltip } from '../ui/Tooltip.jsx';
import styles from './MessageActions.module.css';

/**
 * Hover action row shown beneath each message.
 *
 * - All messages: Copy
 * - User messages: Edit
 * - Assistant messages: Regenerate
 *
 * Edit and Regenerate are disabled while isStreaming is true.
 *
 * @param {{
 *   message: Object,
 *   isStreaming: boolean,
 *   onEdit: () => void,
 *   onRegenerate: () => void,
 * }} props
 */
export function MessageActions({ message, isStreaming, onEdit, onRegenerate }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be blocked in some contexts
    }
  }, [message.content]);

  return (
    <div className={styles.actions} role="group" aria-label="Message actions">
      {/* Copy — available on all messages */}
      <Tooltip label={copied ? 'Copied!' : 'Copy'}>
        <button
          className={styles.btn}
          onClick={handleCopy}
          aria-label={copied ? 'Copied to clipboard' : 'Copy message'}
        >
          {copied ? <IconCheck size={15} stroke={2} /> : <IconCopy size={15} stroke={1.75} />}
        </button>
      </Tooltip>

      {/* Edit — user messages only */}
      {message.role === 'user' && (
        <Tooltip label={isStreaming ? 'Cannot edit while generating' : 'Edit message'}>
          <button
            className={styles.btn}
            onClick={onEdit}
            aria-label="Edit message"
            disabled={isStreaming}
          >
            <IconPencil size={15} stroke={1.75} />
          </button>
        </Tooltip>
      )}

      {/* Regenerate — assistant messages only */}
      {message.role === 'assistant' && (
        <Tooltip label={isStreaming ? 'Cannot regenerate while generating' : 'Regenerate response'}>
          <button
            className={styles.btn}
            onClick={onRegenerate}
            aria-label="Regenerate response"
            disabled={isStreaming}
          >
            <IconRefresh size={15} stroke={1.75} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
