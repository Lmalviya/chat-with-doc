import styles from './StreamingCursor.module.css';

/**
 * Blinking cursor appended to streaming AI messages.
 * Uses aria-hidden so screen readers don't announce the cursor character.
 */
export function StreamingCursor() {
  return (
    <span className={styles.cursor} aria-hidden="true">
      ▋
    </span>
  );
}
