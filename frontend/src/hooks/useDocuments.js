import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  deleteDocumentsBatch,
  getDocumentDownloadUrl,
} from '../api/documents.js';
import { createDraftConversation } from '../api/conversations.js';
import { validateFile } from '../utils/fileValidation.js';
import { DOC_STATUS, MAX_DOCS_PER_CONVERSATION } from '../utils/constants.js';

/**
 * Manage the document list, multi-file uploads, and batch actions for a conversation.
 *
 * @param {string|null} conversationId
 * @param {{ onConversationCreated?: (newId: string) => void }} options
 */
export function useDocuments(conversationId, { onConversationCreated } = {}) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(new Map());
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());

  const activeConvIdRef = useRef(conversationId);
  activeConvIdRef.current = conversationId;

  const loadDocuments = useCallback(async (convId = activeConvIdRef.current) => {
    if (!convId || convId === 'new') {
      setDocuments([]);
      return;
    }
    setIsLoading(true);
    try {
      const docs = await getDocuments(convId);
      setDocuments(docs ?? []);
    } catch {
      // Non-fatal — show empty list
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Upload one or multiple files.
   * If on a new chat (/c/new), auto-provisions a draft conversation first!
   *
   * @param {File | FileList | File[]} filesInput
   */
  const uploadFiles = useCallback(async (filesInput) => {
    const rawFiles = filesInput instanceof FileList
      ? Array.from(filesInput)
      : Array.isArray(filesInput)
        ? filesInput
        : [filesInput];

    if (rawFiles.length === 0) return;

    // 1. If currently on /c/new or no conversationId, create empty draft conversation first!
    let targetConvId = activeConvIdRef.current;
    if (!targetConvId || targetConvId === 'new') {
      try {
        const draftConv = await createDraftConversation();
        targetConvId = draftConv.conversation_id;
        activeConvIdRef.current = targetConvId;
        if (onConversationCreated) {
          onConversationCreated(targetConvId);
        }
      } catch (err) {
        toast.error(`Failed to initialize new conversation: ${err.message}`);
        return;
      }
    }

    // 2. Validate files and check count limits
    const validFiles = [];
    for (const file of rawFiles) {
      const { valid, error } = validateFile(file);
      if (!valid) {
        toast.error(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) return;

    if (documents.length + validFiles.length > MAX_DOCS_PER_CONVERSATION) {
      toast.error(`Limit exceeded. Maximum ${MAX_DOCS_PER_CONVERSATION} documents per conversation.`);
      return;
    }

    // 3. Upload files concurrently to Cloudflare R2
    const uploadPromises = validFiles.map(async (file) => {
      const uploadKey = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      setUploadingFiles((prev) => {
        const next = new Map(prev);
        next.set(uploadKey, { file, progress: 0 });
        return next;
      });

      try {
        const result = await uploadDocument(targetConvId, file, {
          onProgress: (pct) => {
            setUploadingFiles((prev) => {
              const next = new Map(prev);
              if (next.has(uploadKey)) {
                next.set(uploadKey, { ...next.get(uploadKey), progress: pct });
              }
              return next;
            });
          },
        });

        // Add confirmed document to list
        const newDoc = {
          document_id: result.document_id,
          filename: file.name,
          file_type: file.type,
          size_bytes: file.size,
          status: result.status || DOC_STATUS.READY,
          created_at: new Date().toISOString(),
        };

        setDocuments((prev) => {
          const exists = prev.some((d) => d.document_id === newDoc.document_id);
          return exists ? prev : [newDoc, ...prev];
        });

        toast.success(`Uploaded ${file.name}`);
      } catch (err) {
        setUploadingFiles((prev) => {
          const next = new Map(prev);
          if (next.has(uploadKey)) {
            next.set(uploadKey, { ...next.get(uploadKey), error: err.message });
          }
          return next;
        });
        toast.error(`Upload failed for ${file.name}: ${err.message}`);
      } finally {
        setTimeout(() => {
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            next.delete(uploadKey);
            return next;
          });
        }, 1000);
      }
    });

    await Promise.allSettled(uploadPromises);
  }, [documents.length, onConversationCreated]);

  /** Single document delete */
  const removeDocument = useCallback(async (docId) => {
    const convId = activeConvIdRef.current;
    if (!convId || convId === 'new') return;

    // Optimistic removal
    setDocuments((prev) => prev.filter((d) => d.document_id !== docId));
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      next.delete(docId);
      return next;
    });

    try {
      await deleteDocument(convId, docId);
      toast.success('Document deleted');
    } catch (err) {
      toast.error(`Failed to delete: ${err.message}`);
      loadDocuments(convId);
    }
  }, [loadDocuments]);

  /** Batch documents delete */
  const removeDocumentsBatch = useCallback(async (docIdsToDelete) => {
    const convId = activeConvIdRef.current;
    if (!convId || convId === 'new' || !docIdsToDelete?.length) return;

    const idSet = new Set(docIdsToDelete);
    // Optimistic removal
    setDocuments((prev) => prev.filter((d) => !idSet.has(d.document_id)));
    setSelectedDocIds(new Set());

    try {
      await deleteDocumentsBatch(convId, docIdsToDelete);
      toast.success(`Deleted ${docIdsToDelete.length} documents`);
    } catch (err) {
      toast.error(`Failed to delete documents: ${err.message}`);
      loadDocuments(convId);
    }
  }, [loadDocuments]);

  /** Delete all documents attached to this conversation */
  const removeAllDocuments = useCallback(async () => {
    const allIds = documents.map((d) => d.document_id);
    if (allIds.length > 0) {
      await removeDocumentsBatch(allIds);
    }
  }, [documents, removeDocumentsBatch]);

  /** View or download document directly from R2 */
  const downloadDocument = useCallback(async (docId) => {
    const convId = activeConvIdRef.current;
    if (!convId || convId === 'new') return;

    try {
      const { download_url } = await getDocumentDownloadUrl(convId, docId);
      if (download_url) {
        window.open(download_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      toast.error(`Failed to open document: ${err.message}`);
    }
  }, []);

  /** Toggle selection checkbox for batch operations */
  const toggleSelectDoc = useCallback((docId) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const selectAllDocs = useCallback(() => {
    setSelectedDocIds(new Set(documents.map((d) => d.document_id)));
  }, [documents]);

  const clearSelection = useCallback(() => {
    setSelectedDocIds(new Set());
  }, []);

  return {
    documents,
    isLoading,
    loadDocuments,
    uploadFiles,
    uploadFile: uploadFiles, // Backward compatibility alias
    removeDocument,
    removeDocumentsBatch,
    removeAllDocuments,
    downloadDocument,
    uploadingFiles,
    selectedDocIds,
    toggleSelectDoc,
    selectAllDocs,
    clearSelection,
  };
}
