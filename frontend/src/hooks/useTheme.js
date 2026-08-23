import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'docmind-theme';
const THEMES = ['light', 'dark', 'eye-comfort'];

/**
 * Detect the OS-level color scheme preference.
 * @returns {'light'|'dark'}
 */
function getOSPreference() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Read persisted theme from localStorage.
 * Falls back to OS preference, then 'light'.
 * @returns {string}
 */
function resolveInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.includes(stored)) return stored;
  } catch { /* localStorage blocked */ }
  return getOSPreference();
}

/**
 * Apply the theme by setting data-theme on <html> and persisting to localStorage.
 * @param {string} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignore */ }
}

/**
 * useTheme — manages the three-theme system.
 *
 * Theme is stored in localStorage and applied via data-theme on <html>.
 * No per-component conditional logic — all theming is pure CSS custom properties.
 *
 * Theme preference is independent of anon_id / session expiry.
 *
 * @returns {{ theme: string, setTheme: (t: string) => void, themes: string[] }}
 */
export function useTheme() {
  const [theme, setThemeState] = useState(resolveInitialTheme);

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Also apply immediately on first paint (before React hydrates)
  // by calling applyTheme during module evaluation — see main.jsx

  const setTheme = useCallback((newTheme) => {
    if (!THEMES.includes(newTheme)) return;
    setThemeState(newTheme);
  }, []);

  return { theme, setTheme, themes: THEMES };
}

/**
 * Call this once at app startup (in main.jsx) to apply the theme before
 * the first React render, preventing a flash of unstyled content.
 */
export function initTheme() {
  applyTheme(resolveInitialTheme());
}
