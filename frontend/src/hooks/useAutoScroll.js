import { useRef, useCallback, useEffect } from 'react';

/** Pixels from bottom before we consider the user "at the bottom" */
const BOTTOM_THRESHOLD = 60;

/**
 * Smart auto-scroll hook for the message thread.
 *
 * Behaviour:
 *  - Automatically scrolls to the bottom when new content arrives.
 *  - Stops auto-scrolling if the user has manually scrolled up.
 *  - Resumes auto-scrolling if the user manually scrolls back to the bottom.
 *
 * @returns {{
 *   scrollRef: React.RefObject<HTMLElement>,
 *   scrollToBottom: () => void,
 *   isAtBottom: () => boolean,
 * }}
 */
export function useAutoScroll() {
  const scrollRef = useRef(null);
  const isUserScrolledRef = useRef(false);
  const isScrollingProgrammaticallyRef = useRef(false);

  const isAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    isScrollingProgrammaticallyRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior });
    // Reset flag after animation frame
    requestAnimationFrame(() => {
      isScrollingProgrammaticallyRef.current = false;
    });
  }, []);

  /** Call this whenever new content is added (e.g. on each SSE token) */
  const onNewContent = useCallback(() => {
    if (!isUserScrolledRef.current) {
      scrollToBottom('smooth');
    }
  }, [scrollToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function handleScroll() {
      if (isScrollingProgrammaticallyRef.current) return;

      if (isAtBottom()) {
        isUserScrolledRef.current = false;
      } else {
        isUserScrolledRef.current = true;
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isAtBottom]);

  return { scrollRef, scrollToBottom, onNewContent, isAtBottom };
}
