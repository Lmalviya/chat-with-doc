import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { getSiblings } from '../../utils/messageTree.js';
import styles from './BranchSwitcher.module.css';

/**
 * Branch switcher control: ‹ 2/3 ›
 *
 * Appears only on messages that have more than one sibling.
 * Switching is instant and client-side.
 *
 * @param {{
 *   message: Object,
 *   childrenMap: Map,
 *   onSwitch: (direction: 'prev'|'next', message: Object) => void,
 * }} props
 */
export function BranchSwitcher({ message, childrenMap, onSwitch }) {
  const { siblings, currentIndex } = getSiblings(message, childrenMap);

  if (siblings.length <= 1) return null;

  const current = currentIndex + 1;
  const total = siblings.length;

  return (
    <div className={styles.switcher} aria-label={`Branch ${current} of ${total}`}>
      <button
        className={styles.arrow}
        onClick={() => onSwitch('prev', message)}
        aria-label={`Previous branch (${current} of ${total})`}
        disabled={current === 1}
      >
        <IconChevronLeft size={14} stroke={2} />
      </button>

      {/* Visible text + sr-only for screen readers */}
      <span className={styles.label} aria-hidden="true">
        {current}/{total}
      </span>
      <span className="sr-only">{current} of {total}</span>

      <button
        className={styles.arrow}
        onClick={() => onSwitch('next', message)}
        aria-label={`Next branch (${current} of ${total})`}
        disabled={current === total}
      >
        <IconChevronRight size={14} stroke={2} />
      </button>
    </div>
  );
}
