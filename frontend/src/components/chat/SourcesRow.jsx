import { useState } from 'react';
import { IconChevronDown, IconFile } from '@tabler/icons-react';
import styles from './SourcesRow.module.css';

/**
 * Collapsible "Sources" row shown below a completed AI message
 * that used retrieval.
 *
 * @param {{ sources: Array<{ doc_id: string, filename: string }> }} props
 */
export function SourcesRow({ sources }) {
  const [open, setOpen] = useState(false);

  if (!sources?.length) return null;

  return (
    <div className={styles.root}>
      <button
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${open ? 'Hide' : 'Show'} ${sources.length} source${sources.length > 1 ? 's' : ''}`}
      >
        <span className={styles.label}>
          {sources.length} source{sources.length > 1 ? 's' : ''}
        </span>
        <IconChevronDown
          size={14}
          className={`${styles.chevron} ${open ? styles.open : ''}`}
        />
      </button>

      {open && (
        <ul className={`${styles.list} animate-slide-up`} role="list">
          {sources.map((src) => (
            <li key={src.doc_id} className={styles.item}>
              <IconFile size={13} className={styles.fileIcon} />
              <span>{src.filename}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
