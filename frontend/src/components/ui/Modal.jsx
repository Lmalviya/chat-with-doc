import { useRef, useEffect } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import styles from './Modal.module.css';

/**
 * Focus-trapped modal overlay.
 *
 * - Closes on Escape (handled by useFocusTrap)
 * - Closes on backdrop click
 * - Traps Tab focus within the dialog
 * - Restores focus to the triggering element on close
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   title?: string,
 *   children: React.ReactNode,
 *   size?: 'sm'|'md'|'lg',
 *   className?: string,
 * }} props
 */
export function Modal({ isOpen, onClose, title, children, size = 'md', className = '' }) {
  const containerRef = useRef(null);
  useFocusTrap(containerRef, { active: isOpen, onClose });

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${styles.dialog} ${styles[size]} ${className} animate-scale-in`}
      >
        {title && (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
