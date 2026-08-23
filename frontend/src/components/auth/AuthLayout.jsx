import { IconSparkles } from '@tabler/icons-react';
import styles from './AuthLayout.module.css';

export function AuthLayout({ title, subtitle, children, footerText, footerLinkText, footerLinkHref }) {
  return (
    <div className={styles.container}>
      <div className={styles.backgroundDecor} />
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoWrapper}>
            <IconSparkles size={26} stroke={2} />
          </div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        {children}

        {footerText && (
          <div className={styles.footer}>
            <span>{footerText}</span>
            <a href={footerLinkHref} className={styles.link}>
              {footerLinkText}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
