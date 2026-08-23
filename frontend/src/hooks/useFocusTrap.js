import { useEffect, useRef } from 'react';

/**
 * Trap focus within a container element.
 *
 * While the trap is active:
 *  - Tab / Shift+Tab cycles only through focusable descendants
 *  - Pressing Escape calls onClose()
 *
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {{ active: boolean, onClose: () => void }} options
 */
export function useFocusTrap(containerRef, { active, onClose }) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    // Remember what had focus before the modal opened so we can restore it
    previousFocusRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    // Focus the first focusable element inside the container
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      // Make the container itself focusable as a fallback
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const els = getFocusableElements(container);
      if (els.length === 0) {
        e.preventDefault();
        return;
      }

      const first = els[0];
      const last = els[els.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the element that triggered the modal
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, containerRef, onClose]);
}

/**
 * Return all keyboard-focusable elements within a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusableElements(container) {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'details > summary',
  ].join(',');

  return Array.from(container.querySelectorAll(selector)).filter(
    (el) => !el.closest('[hidden]') && !el.closest('[aria-hidden="true"]'),
  );
}
