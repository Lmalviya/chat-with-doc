import styles from './Spinner.module.css';

/**
 * Animated loading spinner.
 *
 * @param {{ size?: number, label?: string, className?: string }} props
 */
export function Spinner({ size = 20, label = 'Loading…', className = '' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`${styles.spinner} ${className}`}
      style={{ '--spinner-size': `${size}px` }}
    />
  );
}
