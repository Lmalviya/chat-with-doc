import { useRef, useState } from 'react';
import styles from './Tooltip.module.css';

/**
 * Simple tooltip that appears above the wrapped element on hover/focus.
 *
 * @param {{ label: string, children: React.ReactNode, delay?: number }} props
 */
export function Tooltip({ label, children, delay = 400 }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  function show() {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }

  function hide() {
    clearTimeout(timerRef.current);
    setVisible(false);
  }

  return (
    <span
      className={styles.wrapper}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span role="tooltip" className={styles.tooltip}>
          {label}
        </span>
      )}
    </span>
  );
}
