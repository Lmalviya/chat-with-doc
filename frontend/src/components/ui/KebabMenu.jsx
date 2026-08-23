import { useState, useRef, useEffect } from 'react';
import { IconDotsVertical } from '@tabler/icons-react';
import styles from './KebabMenu.module.css';

/**
 * Three-dot kebab menu dropdown.
 *
 * @param {{
 *   items: Array<{ label: string, icon?: React.ReactNode, onClick: () => void, danger?: boolean }>,
 *   ariaLabel?: string,
 * }} props
 */
export function KebabMenu({ items, ariaLabel = 'More options' }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    }
    function onClickOutside(e) {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={menuRef}>
      <button
        ref={triggerRef}
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <IconDotsVertical size={16} />
      </button>

      {open && (
        <ul role="menu" className={`${styles.dropdown} animate-scale-in`}>
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                role="menuitem"
                className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.icon && <span className={styles.icon}>{item.icon}</span>}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
