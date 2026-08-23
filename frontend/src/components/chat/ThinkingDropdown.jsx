import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconChevronRight, IconBrain, IconSparkles } from '@tabler/icons-react';
import styles from './ThinkingDropdown.module.css';

/**
 * ThinkingDropdown — Collapsible reasoning/thought process block.
 *
 * Persists in the message history even after the response is completed.
 *
 * @param {{
 *   thinking: string,
 *   isStreaming: boolean,
 *   thinkingDone: boolean,
 *   elapsedMs?: number | null,
 * }} props
 */
export function ThinkingDropdown({ thinking, isStreaming, thinkingDone, elapsedMs }) {
  const isThinkingActive = isStreaming && !thinkingDone && Boolean(thinking);
  const [isOpen, setIsOpen] = useState(true);
  const [liveSeconds, setLiveSeconds] = useState(0);

  // Live timer tick during active thinking
  useEffect(() => {
    if (!isThinkingActive) return;

    const interval = setInterval(() => {
      setLiveSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isThinkingActive]);

  if (!thinking || !thinking.trim()) return null;

  // Format header label
  let headerLabel = 'Thought process';
  if (isThinkingActive) {
    headerLabel = `Thinking... (${liveSeconds}s)`;
  } else if (elapsedMs != null && elapsedMs > 0) {
    const secs = Math.max(1, Math.round(elapsedMs / 1000));
    headerLabel = `Thought for ${secs}s`;
  }

  return (
    <div className={`${styles.container} ${isOpen ? styles.open : styles.closed}`}>
      <button
        type="button"
        className={styles.headerButton}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Toggle thinking process"
      >
        <span className={styles.headerLeft}>
          <span className={styles.iconWrapper}>
            {isThinkingActive ? (
              <span className={styles.pulsingDot} />
            ) : (
              <IconBrain size={14} className={styles.brainIcon} />
            )}
          </span>
          <span className={styles.headerTitle}>{headerLabel}</span>
        </span>
        <IconChevronRight
          size={14}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        />
      </button>

      {isOpen && (
        <div className={styles.contentWrapper} aria-live={isThinkingActive ? 'polite' : 'off'}>
          <div className={styles.contentInner}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {thinking}
            </ReactMarkdown>
            {isThinkingActive && <span className={styles.thinkingCursor}>▋</span>}
          </div>
        </div>
      )}
    </div>
  );
}
