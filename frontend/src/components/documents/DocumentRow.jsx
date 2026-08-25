import { useState } from 'react';
import { IconEye, IconDownload, IconTrash } from '@tabler/icons-react';
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
 *   onDownload?: (docId: string) => void,
 *   onDelete: (docId: string) => void,
 *   isSelected?: boolean,
 *   onToggleSelect?: (docId: string) => void,
 * }} props
 */
export function DocumentRow({
  document: doc,
  onView,
  onDownload,
  onDelete,
  isSelected = false,
  onToggleSelect,
}) {
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
    <div className={`${styles.row} ${isSelected ? styles.selectedRow : ''}`}>
      {/* Optional multi-select checkbox */}
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(doc.document_id)}
          className={styles.checkbox}
          aria-label={`Select ${doc.filename}`}
        />
      )}

      {/* File type badge */}
      <span className={styles.typeBadge} aria-hidden="true">
        {typeLabel}
      </span>

      {/* File info */}
      <div className={styles.info} onClick={() => onView(doc)} role="button" tabIndex={0}>
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
            label: 'View / Preview',
            icon: <IconEye size={14} />,
            onClick: () => onView(doc),
          },
          ...(onDownload
            ? [
                {
                  label: 'Download',
                  icon: <IconDownload size={14} />,
                  onClick: () => onDownload(doc.document_id),
                },
              ]
            : []),
          {
            label: 'Delete',
            icon: <IconTrash size={14} />,
            danger: true,
            onClick: () => setConfirmingDelete(true),
          },
        ]}
      />
    </div>
  );
}
