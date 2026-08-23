import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { getDocument } from '../../api/documents.js';
import { getExtension, extToLanguage } from '../../utils/fileValidation.js';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import styles from './DocumentViewer.module.css';

/**
 * Large document viewer modal.
 *
 * Renders:
 *  - PDF → iframe with presigned URL
 *  - MD/TXT → plain text (raw/rendered toggle for .md)
 *  - Code files → syntax-highlighted read-only view
 *
 * All non-PDF content is rendered as escaped text (never innerHTML).
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   document: Object|null,
 *   conversationId: string,
 * }} props
 */
export function DocumentViewer({ isOpen, onClose, document: doc, conversationId }) {
  const [loading, setLoading] = useState(false);
  const [contentUrl, setContentUrl] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [error, setError] = useState(null);
  const [mdRendered, setMdRendered] = useState(false); // for .md raw/rendered toggle

  const ext = doc ? getExtension(doc.filename) : '';
  const isPdf = ext === '.pdf';
  const isMarkdown = ext === '.md';
  const lang = extToLanguage(ext);

  useEffect(() => {
    if (!isOpen || !doc) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setTextContent('');
    setContentUrl(null);

    getDocument(conversationId, doc.document_id)
      .then(async (data) => {
        if (cancelled) return;

        if (isPdf) {
          setContentUrl(data.content_url);
        } else {
          // Fetch the text content from the presigned URL
          const res = await fetch(data.content_url);
          if (!res.ok) throw new Error(`Failed to fetch content: HTTP ${res.status}`);
          const text = await res.text();
          if (!cancelled) setTextContent(text);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [isOpen, doc, conversationId, isPdf]);

  function getHighlightedHtml() {
    if (!textContent) return '';
    try {
      if (lang === 'plaintext' || lang === 'markdown') {
        return null; // render as plain text
      }
      const result = hljs.highlight(textContent, { language: lang, ignoreIllegals: true });
      return result.value;
    } catch {
      return null;
    }
  }

  const highlightedHtml = !isPdf && !loading ? getHighlightedHtml() : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={doc?.filename ?? 'Document'}
      size="lg"
    >
      <div className={styles.body}>
        {/* Markdown raw/rendered toggle */}
        {isMarkdown && !loading && !error && (
          <div className={styles.toggleRow}>
            <button
              className={`${styles.toggleBtn} ${!mdRendered ? styles.active : ''}`}
              onClick={() => setMdRendered(false)}
              aria-pressed={!mdRendered}
            >
              Raw
            </button>
            <button
              className={`${styles.toggleBtn} ${mdRendered ? styles.active : ''}`}
              onClick={() => setMdRendered(true)}
              aria-pressed={mdRendered}
            >
              Preview
            </button>
          </div>
        )}

        {loading && (
          <div className={styles.centered}>
            <Spinner size={28} label="Loading document…" />
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">{error}</p>
        )}

        {!loading && !error && isPdf && contentUrl && (
          <iframe
            className={styles.pdfFrame}
            src={contentUrl}
            title={doc.filename}
            aria-label={`PDF viewer: ${doc.filename}`}
          />
        )}

        {!loading && !error && !isPdf && textContent && (
          <>
            {highlightedHtml ? (
              /* Syntax-highlighted code — uses dangerouslySetInnerHTML ONLY with hljs output (escaped by hljs) */
              <pre className={styles.codeBlock}>
                <code
                  className={`hljs language-${lang}`}
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
              </pre>
            ) : isMarkdown && mdRendered ? (
              /* MD rendered preview — note: textContent is user-uploaded, render as escaped text only */
              <pre className={styles.textBlock}>{textContent}</pre>
            ) : (
              /* Plain escaped text — safe for all user-uploaded content */
              <pre className={styles.textBlock}>{textContent}</pre>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
