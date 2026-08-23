import styles from './InlineDeleteConfirm.module.css';

/**
 * Inline lightweight delete confirmation — replaces the row content.
 * Not a modal: shows Confirm/Cancel in place.
 *
 * @param {{
 *   label?: string,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export function InlineDeleteConfirm({ label = 'Delete this document?', onConfirm, onCancel }) {
  return (
    <div className={styles.row} role="alert" aria-label={label}>
      <span className={styles.label}>{label}</span>
      <button
        className={`${styles.btn} ${styles.confirm}`}
        onClick={(e) => { e.stopPropagation(); onConfirm(); }}
        aria-label="Confirm delete"
      >
        Delete
      </button>
      <button
        className={styles.btn}
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        aria-label="Cancel delete"
      >
        Cancel
      </button>
    </div>
  );
}
