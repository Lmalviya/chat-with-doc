import { useState, useEffect, useRef } from 'react';
import { IconX } from '@tabler/icons-react';
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
 *  - Upload dropzone
 *  - List of conversation-scoped documents
 *  - Per-row: View / Replace / Delete via kebab menu
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   conversationId: string | null,
 *   anchorRef?: React.RefObject<HTMLElement>,
 * }} props
 */
export function DocumentPopup({ isOpen, onClose, conversationId }) {
  const containerRef = useRef(null);
  useFocusTrap(containerRef, { active: isOpen, onClose });

  const { documents, isLoading, loadDocuments, uploadFile, removeDocument } =
    useDocuments(conversationId);

  const [viewerDoc, setViewerDoc] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const replaceInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && conversationId) loadDocuments();
  }, [isOpen, conversationId, loadDocuments]);

  // Handle replace: trigger hidden file input
  useEffect(() => {
    if (replaceTarget && replaceInputRef.current) {
      replaceInputRef.current.click();
    }
  }, [replaceTarget]);

  async function handleFiles(files) {
    for (const file of files) {
      await uploadFile(file);
    }
  }

  async function handleReplaceFiles(e) {
    const file = e.target.files?.[0];
    if (!file || !replaceTarget) return;
    await uploadFile(file, { replaceDocId: replaceTarget.document_id });
    setReplaceTarget(null);
    e.target.value = '';
  }

  if (!isOpen) return null;

  const hasConversation = Boolean(conversationId);

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

        {/* Upload zone */}
        <div className={styles.dropzoneArea}>
          {hasConversation ? (
            <UploadDropzone
              onFiles={handleFiles}
              disabled={documents.length >= MAX_DOCS_PER_CONVERSATION}
            />
          ) : (
            <p className={styles.noConversation}>
              Send your first message to attach documents to this conversation.
            </p>
          )}
        </div>

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
                    onView={(d) => setViewerDoc(d)}
                    onReplace={(d) => setReplaceTarget(d)}
                    onDelete={removeDocument}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hidden replace file input */}
        <input
          ref={replaceInputRef}
          type="file"
          aria-hidden="true"
          tabIndex={-1}
          style={{ display: 'none' }}
          accept=".pdf,.txt,.md,.py,.js,.ts,.jsx,.tsx,.java,.go,.rs,.cpp,.c,.h,.rb,.php"
          onChange={handleReplaceFiles}
        />
      </div>

      {/* Document viewer — separate modal */}
      {viewerDoc && conversationId && (
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
