import { formatDistanceToNow } from 'date-fns';

/**
 * Format a date/ISO string as a relative human-readable label.
 * Examples: "just now", "3m ago", "2h ago", "yesterday", "Jan 5"
 *
 * @param {string|Date|number} date
 * @returns {string}
 */
export function formatRelativeDate(date) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Format an ISO date string as a short absolute label for accessibility text.
 * @param {string|Date} date
 * @returns {string} e.g. "Aug 20, 2026 at 12:34 AM"
 */
export function formatAbsoluteDate(date) {
  try {
    return new Date(date).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
