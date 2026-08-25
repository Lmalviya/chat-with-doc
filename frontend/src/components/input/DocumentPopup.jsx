import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconX, IconTrash } from '@tabler/icons-react';
import { DocumentRow } from '../documents/DocumentRow.jsx';
import { DocumentViewer } from '../documents/DocumentViewer.jsx';
import { UploadDropzone } from '../documents/UploadDropzone.jsx';
import { useDocuments } from '../../hooks/useDocuments.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { MAX_DOCS_PER_CONVERSATION, MAX_FILE_SIZE_LABEL } from '../../utils/constants.js';
import { Spinner } from '../ui/Spinner.jsx';
import styles from './DocumentPopup.module.css';

/**
 * Document attach popup — shown when the user clicks the attach button.
 *
 * Contains:
 *  - Multi-file Upload dropzone (works even on /c/new)
 *  - Batch selection toolbar ("Select All", "Delete Selected", "Delete All")
 *  - List of conversation-scoped documents with direct download & view
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   conversationId: string | null,
 * }} props
 */
export function DocumentPopup({ isOpen, onClose, conversationId }) {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  useFocusTrap(containerRef, { active: isOpen, onClose });

  const {
    documents,
    isLoading,
    loadDocuments,
    uploadFiles,
    removeDocument,
    removeDocumentsBatch,
    removeAllDocuments,
    downloadDocument,
    selectedDocIds,
    toggleSelectDoc,
    selectAllDocs,
    clearSelection,
  } = useDocuments(conversationId, {
    onConversationCreated: (newId) => {
      // Seamlessly navigate to the newly provisioned conversation
      navigate(`/c/${newId}`, { replace: true });
    },
  });

  const [viewerDoc, setViewerDoc] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadDocuments(conversationId);
    }
  }, [isOpen, conversationId, loadDocuments]);

  if (!isOpen) return null;

  const isAllSelected = documents.length > 0 && selectedDocIds.size === documents.length;
  const selectedCount = selectedDocIds.size;

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Manage documents"
        className={`${styles.popup} animate-scale-in`}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Documents</h2>
          <div className={styles.headerMeta}>
            <span className={styles.limits}>
              Max {MAX_FILE_SIZE_LABEL}/file · {MAX_DOCS_PER_CONVERSATION} docs max
            </span>
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close documents panel"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Upload zone — works on both existing chats and /c/new */}
        <div className={styles.dropzoneArea}>
          <UploadDropzone
            onFiles={uploadFiles}
            disabled={documents.length >= MAX_DOCS_PER_CONVERSATION}
          />
        </div>

        {/* Batch action toolbar */}
        {documents.length > 0 && (
          <div className={styles.actionBar}>
            <label className={styles.selectGroup}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() => (isAllSelected ? clearSelection() : selectAllDocs())}
              />
              <span>{isAllSelected ? 'Deselect all' : 'Select all'}</span>
            </label>

            <div className={styles.actionButtons}>
              {selectedCount > 0 && (
                <button
                  type="button"
                  className={`${styles.batchBtn} ${styles.batchBtnDanger}`}
                  onClick={() => removeDocumentsBatch(Array.from(selectedDocIds))}
                >
                  <IconTrash size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                  Delete selected ({selectedCount})
                </button>
              )}
              {selectedCount === 0 && (
                <button
                  type="button"
                  className={`${styles.batchBtn} ${styles.batchBtnDanger}`}
                  onClick={removeAllDocuments}
                >
                  Delete all
                </button>
              )}
            </div>
          </div>
        )}

        {/* Document list */}
        <div className={styles.listArea}>
          {isLoading ? (
            <div className={styles.centered}>
              <Spinner size={20} label="Loading documents…" />
            </div>
          ) : documents.length === 0 ? (
            <p className={styles.emptyText}>No documents attached yet.</p>
          ) : (
            <ul className={styles.list} role="list" aria-label="Attached documents">
              {documents.map((doc) => (
                <li key={doc.document_id} role="listitem">
                  <DocumentRow
                    document={doc}
                    isSelected={selectedDocIds.has(doc.document_id)}
                    onToggleSelect={toggleSelectDoc}
                    onView={(d) => setViewerDoc(d)}
                    onDownload={downloadDocument}
                    onDelete={removeDocument}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Document viewer modal */}
      {viewerDoc && conversationId && conversationId !== 'new' && (
        <DocumentViewer
          isOpen={Boolean(viewerDoc)}
          onClose={() => setViewerDoc(null)}
          document={viewerDoc}
          conversationId={conversationId}
        />
      )}
    </>
  );
}
