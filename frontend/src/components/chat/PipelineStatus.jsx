import { IconLoader2, IconSparkles, IconSearch, IconBrain } from '@tabler/icons-react';
import styles from './PipelineStatus.module.css';

/**
 * PipelineStatus — Shows real-time intermediate engine stages during chat streaming.
 *
 * @param {{
 *   stageText: string,
 *   stages?: Array<{ stage: string, content: string }>,
 * }} props
 */
export function PipelineStatus({ stageText, stages = [] }) {
  if (!stageText && (!stages || stages.length === 0)) return null;

  const currentText = stageText || (stages.length > 0 ? stages[stages.length - 1].content : '');
  if (!currentText) return null;

  // Pick an intuitive icon based on stage keyword
  let Icon = IconSparkles;
  const lower = currentText.toLowerCase();
  if (lower.includes('search') || lower.includes('retriev') || lower.includes('knowledge')) {
    Icon = IconSearch;
  } else if (lower.includes('analys') || lower.includes('query') || lower.includes('decis')) {
    Icon = IconBrain;
  } else if (lower.includes('generat')) {
    Icon = IconSparkles;
  }

  return (
    <div className={styles.statusContainer} aria-live="polite">
      <div className={styles.statusPill}>
        <span className={styles.iconWrapper}>
          <Icon size={14} className={styles.stageIcon} />
        </span>
        <span className={styles.statusText}>{currentText}</span>
        <span className={styles.spinnerWrapper}>
          <IconLoader2 size={12} className={styles.spinner} />
        </span>
      </div>
    </div>
  );
}
