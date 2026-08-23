import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { getDocuments, uploadDocument, deleteDocument } from '../api/documents.js';
import { validateFile } from '../utils/fileValidation.js';
import { DOC_STATUS, DOC_POLL_INTERVAL_MS, MAX_DOCS_PER_CONVERSATION } from '../utils/constants.js';

/**
 * Manage the document list for a conversation.
 *
 * @param {string|null} conversationId
 * @returns {{
 *   documents: Array,
 *   isLoading: boolean,
 *   loadDocuments: () => Promise<void>,
 *   uploadFile: (file: File, options?: { replaceDocId?: string }) => Promise<void>,
 *   removeDocument: (docId: string) => Promise<void>,
 *   uploadingFiles: Map<string, { file: File, progress: number, error?: string }>,
 * }}
 */
export function useDocuments(conversationId) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(new Map());
  const pollTimersRef = useRef(new Map());

  const loadDocuments = useCallback(async () => {
    if (!conversationId) return;
    setIsLoading(true);
    try {
      const docs = await getDocuments(conversationId);
      setDocuments(docs ?? []);
    } catch {
      // Non-fatal — show empty list
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  /** Poll a single document until its status is no longer 'uploading' */
  const pollDocumentStatus = useCallback((docId) => {
    if (pollTimersRef.current.has(docId)) return;

    const timerId = setInterval(async () => {
      try {
        const docs = await getDocuments(conversationId);
        const doc = docs?.find((d) => d.document_id === docId);

        if (!doc || doc.status !== DOC_STATUS.UPLOADING) {
          clearInterval(timerId);
          pollTimersRef.current.delete(docId);
          setDocuments(docs ?? []);
        }
      } catch {
        clearInterval(timerId);
        pollTimersRef.current.delete(docId);
      }
    }, DOC_POLL_INTERVAL_MS);

    pollTimersRef.current.set(docId, timerId);
  }, [conversationId]);

  const uploadFile = useCallback(async (file, { replaceDocId } = {}) => {
    if (!conversationId) return;

    // Client-side validation
    const { valid, error } = validateFile(file);
    if (!valid) {
      toast.error(error);
      return;
    }

    // Max doc count check (skip when replacing)
    if (!replaceDocId && documents.length >= MAX_DOCS_PER_CONVERSATION) {
      toast.error(`Maximum ${MAX_DOCS_PER_CONVERSATION} documents per conversation.`);
      return;
    }

    const uploadKey = `${file.name}-${Date.now()}`;

    setUploadingFiles((prev) => {
      const next = new Map(prev);
      next.set(uploadKey, { file, progress: 0 });
      return next;
    });

    try {
      const result = await uploadDocument(conversationId, file, {
        replace: replaceDocId ? { docId: replaceDocId } : undefined,
        onProgress: (pct) => {
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            if (next.has(uploadKey)) next.set(uploadKey, { ...next.get(uploadKey), progress: pct });
            return next;
          });
        },
      });

      // Optimistically add/update the document in the list
      const newDoc = {
        document_id: result.document_id,
        filename: file.name,
        file_type: file.type,
        size_bytes: file.size,
        status: DOC_STATUS.UPLOADING,
        created_at: new Date().toISOString(),
      };

      setDocuments((prev) => {
        if (replaceDocId) {
          return prev.map((d) => (d.document_id === replaceDocId ? newDoc : d));
        }
        return [...prev, newDoc];
      });

      // Start polling until backend marks it 'ready'
      if (result.document_id) pollDocumentStatus(result.document_id);

    } catch (err) {
      setUploadingFiles((prev) => {
        const next = new Map(prev);
        if (next.has(uploadKey)) next.set(uploadKey, { ...next.get(uploadKey), error: err.message });
        return next;
      });
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      // Remove from uploading map after a short delay so progress bar is visible
      setTimeout(() => {
        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.delete(uploadKey);
          return next;
        });
      }, 800);
    }
  }, [conversationId, documents.length, pollDocumentStatus]);

  const removeDocument = useCallback(async (docId) => {
    // Optimistic removal
    setDocuments((prev) => prev.filter((d) => d.document_id !== docId));

    // Cancel any poll for this doc
    const timer = pollTimersRef.current.get(docId);
    if (timer) {
      clearInterval(timer);
      pollTimersRef.current.delete(docId);
    }

    try {
      await deleteDocument(conversationId, docId);
    } catch (err) {
      toast.error(`Failed to delete document: ${err.message}`);
      // Re-fetch to restore the list
      loadDocuments();
    }
  }, [conversationId, loadDocuments]);

  return {
    documents,
    isLoading,
    loadDocuments,
    uploadFile,
    removeDocument,
    uploadingFiles,
  };
}
