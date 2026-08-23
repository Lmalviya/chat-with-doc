import { useState, useRef, useCallback, useEffect } from 'react';
import { IconPaperclip, IconSend, IconPlayerStop } from '@tabler/icons-react';
import { DocumentPopup } from './DocumentPopup.jsx';
import styles from './InputBar.module.css';

const MAX_TEXTAREA_HEIGHT = 200;

/**
 * Sticky input bar at the bottom of the chat.
 *
 * Layout: [attach button] [auto-grow textarea] [send | stop button]
 *
 * - Enter sends; Shift+Enter inserts a newline
 * - Textarea auto-grows up to MAX_TEXTAREA_HEIGHT then scrolls
 * - Entire input is disabled while generating (except stop button)
 * - Stop button replaces send icon while streaming
 *
 * @param {{
 *   conversationId: string | null,
 *   isStreaming: boolean,
 *   onSend: (content: string) => void,
 *   onStop: () => void,
 * }} props
 */
export function InputBar({ conversationId, isStreaming, onSend, onStop }) {
  const [value, setValue] = useState('');
  const [docPopupOpen, setDocPopupOpen] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    setValue('');
    // Reset height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(trimmed);
  }, [value, isStreaming, onSend]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <div className={styles.wrapper}>
      {/* Document popup */}
      <DocumentPopup
        isOpen={docPopupOpen}
        onClose={() => setDocPopupOpen(false)}
        conversationId={conversationId}
      />

      <div className={`${styles.bar} ${isStreaming ? styles.generating : ''}`}>
        {/* Attach button */}
        <button
          className={styles.attachBtn}
          onClick={() => setDocPopupOpen((v) => !v)}
          aria-label="Attach document"
          aria-expanded={docPopupOpen}
          aria-haspopup="dialog"
          disabled={isStreaming}
          type="button"
        >
          <IconPaperclip size={20} stroke={1.75} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your documents…"
          rows={1}
          disabled={isStreaming}
          aria-label="Message input"
          aria-multiline="true"
        />

        {/* Send / Stop button */}
        {isStreaming ? (
          <button
            className={`${styles.sendBtn} ${styles.stopBtn}`}
            onClick={onStop}
            aria-label="Stop generation"
            type="button"
          >
            <IconPlayerStop size={18} fill="currentColor" stroke={0} />
          </button>
        ) : (
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            aria-label="Send message"
            disabled={!canSend}
            type="button"
          >
            <IconSend size={18} stroke={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}
