import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSparkles, IconClock, IconFileText, IconDatabase } from '@tabler/icons-react';
import { InputBar } from '../input/InputBar.jsx';
import styles from './LandingView.module.css';

const SUGGESTIONS = [
  { icon: IconDatabase, text: 'Explain the difference between SQL and NoSQL' },
  { icon: IconFileText, text: 'Summarize key points from my attached document' },
  { icon: IconSparkles, text: 'How does asynchronous I/O work in Python?' },
];

/**
 * Landing / empty state — shown at route '/'.
 *
 * - Centered greeting + subtitle + suggestion chips
 * - Session indicator badge
 * - Input bar to start a new chat
 */
export function LandingView() {
  const navigate = useNavigate();

  const handleSend = useCallback((content) => {
    const requestId = crypto.randomUUID();

    // Navigate to /c/new with pending message state
    navigate('/c/new', {
      state: { pendingMessage: content, requestId, isNewConversation: true },
    });
  }, [navigate]);

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <div className={styles.sessionBadge}>
          <IconClock size={14} stroke={1.75} />
          <span>Private 24-Hour Anonymous Workspace</span>
        </div>

        <h1 className={styles.heading}>What are you working on?</h1>
        <p className={styles.subtitle}>
          Upload documents and ask questions — your AI research assistant is ready.
        </p>

        <div className={styles.suggestionsList}>
          {SUGGESTIONS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                className={styles.suggestionChip}
                onClick={() => handleSend(item.text)}
                aria-label={`Prompt suggestion: ${item.text}`}
              >
                <Icon size={16} stroke={1.75} className={styles.chipIcon} />
                <span>{item.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.inputArea}>
        <InputBar
          conversationId={null}
          isStreaming={false}
          onSend={handleSend}
          onStop={() => {}}
        />
      </div>
    </div>
  );
}
