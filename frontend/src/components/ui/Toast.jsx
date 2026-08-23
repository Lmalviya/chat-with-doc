import { Toaster } from 'react-hot-toast';

/**
 * Toast provider configured with sensible defaults.
 * Wrap this around the app root.
 */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
        },
        success: {
          iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-surface)' },
        },
        error: {
          iconTheme: { primary: 'var(--danger)', secondary: 'var(--bg-surface)' },
          duration: 5000,
        },
      }}
    />
  );
}
