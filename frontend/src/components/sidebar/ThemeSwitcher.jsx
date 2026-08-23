import { IconSun, IconMoon, IconEye } from '@tabler/icons-react';
import { useTheme } from '../../hooks/useTheme.js';
import styles from './ThemeSwitcher.module.css';

const THEME_OPTIONS = [
  { key: 'light',       Icon: IconSun,  label: 'Light theme'       },
  { key: 'dark',        Icon: IconMoon, label: 'Dark theme'         },
  { key: 'eye-comfort', Icon: IconEye,  label: 'Eye comfort theme'  },
];

/**
 * Compact three-icon segmented control for theme selection.
 * Pinned to the bottom of the sidebar.
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.control} role="group" aria-label="Theme">
      {THEME_OPTIONS.map(({ key, Icon, label }) => (
        <button
          key={key}
          className={`${styles.option} ${theme === key ? styles.active : ''}`}
          aria-label={label}
          aria-pressed={theme === key}
          onClick={() => setTheme(key)}
        >
          <Icon size={16} stroke={1.75} />
        </button>
      ))}
    </div>
  );
}
