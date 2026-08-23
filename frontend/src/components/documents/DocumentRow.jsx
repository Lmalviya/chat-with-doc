import { useState } from 'react';
import { IconEye, IconRefresh, IconFile } from '@tabler/icons-react';
import { KebabMenu } from '../ui/KebabMenu.jsx';
import { InlineDeleteConfirm } from './InlineDeleteConfirm.jsx';
import { DOC_STATUS } from '../../utils/constants.js';
import { formatFileSize, getFileTypeLabel, getExtension } from '../../utils/fileValidation.js';
import styles from './DocumentRow.module.css';

const STATUS_LABELS = {
  [DOC_STATUS.UPLOADING]: 'Uploading…',
  [DOC_STATUS.READY]:     'Ready',
  [DOC_STATUS.FAILED]:    'Failed',
};

/**
 * A single document row in the attach popup.
 *
 * @param {{
 *   document: Object,
 *   onView: (doc: Object) => void,
 *   onReplace: (doc: Object) => void,
 *   onDelete: (docId: string) => void,
 * }} props
 */
export function DocumentRow({ document: doc, onView, onReplace, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const ext = getExtension(doc.filename);
  const typeLabel = getFileTypeLabel(ext);
  const sizeLabel = doc.size_bytes ? formatFileSize(doc.size_bytes) : '';

  if (confirmingDelete) {
    return (
      <InlineDeleteConfirm
        label={`Delete "${doc.filename}"?`}
        onConfirm={() => { setConfirmingDelete(false); onDelete(doc.document_id); }}
        onCancel={() => setConfirmingDelete(false)}
      />
    );
  }

  return (
    <div className={styles.row}>
      {/* File type badge */}
      <span className={styles.typeBadge} aria-hidden="true">
        {typeLabel}
      </span>

      {/* File info */}
      <div className={styles.info}>
        <span className={styles.filename} title={doc.filename}>
          {doc.filename}
        </span>
        <span className={styles.meta}>
          {sizeLabel && <span>{sizeLabel}</span>}
          <span
            className={`${styles.status} ${styles[`status_${doc.status}`]}`}
            aria-label={`Status: ${STATUS_LABELS[doc.status] ?? doc.status}`}
          >
            {doc.status === DOC_STATUS.UPLOADING && (
              <span className={styles.uploadingDot} aria-hidden="true" />
            )}
            {STATUS_LABELS[doc.status] ?? doc.status}
          </span>
        </span>
      </div>

      {/* Kebab menu */}
      <KebabMenu
        ariaLabel={`Options for ${doc.filename}`}
        items={[
          {
            label: 'View',
            icon: <IconEye size={14} />,
            onClick: () => onView(doc),
          },
          {
            label: 'Replace',
            icon: <IconRefresh size={14} />,
            onClick: () => onReplace(doc),
          },
          {
            label: 'Delete',
            icon: <IconFile size={14} />,
            danger: true,
            onClick: () => setConfirmingDelete(true),
          },
        ]}
      />
    </div>
  );
}
