import { useState, useRef, useEffect } from 'react';
import styles from './InlineEditor.module.css';

/**
 * Inline editable textarea that replaces a user message bubble.
 *
 * - Save is disabled until content actually changes.
 * - Cancel reverts with no backend call.
 * - Enter (without Shift) saves.
 *
 * @param {{
 *   initialContent: string,
 *   onSave: (newContent: string) => void,
 *   onCancel: () => void,
 * }} props
 */
export function InlineEditor({ initialContent, onSave, onCancel }) {
  const [value, setValue] = useState(initialContent);
  const textareaRef = useRef(null);

  useEffect(() => {
    // Auto-focus and place cursor at end
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, []);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const hasChanged = value.trim() !== initialContent.trim();
  const isEmpty = !value.trim();

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (hasChanged && !isEmpty) onSave(value.trim());
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className={styles.root}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Edit message"
        rows={1}
      />
      <div className={styles.actions}>
        <button
          className={styles.cancelBtn}
          onClick={onCancel}
          aria-label="Cancel editing"
        >
          Cancel
        </button>
        <button
          className={styles.saveBtn}
          onClick={() => onSave(value.trim())}
          disabled={!hasChanged || isEmpty}
          aria-label="Save edited message"
        >
          Save
        </button>
      </div>
    </div>
  );
}
