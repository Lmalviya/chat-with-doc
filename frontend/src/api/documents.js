import { apiJSON, uploadToStorage } from './client.js';

/**
 * GET /conversations/:conversationId/documents
 * Returns document metadata list (no content — kept fast).
 *
 * @param {string} conversationId
 * @returns {Promise<Array<{document_id, filename, file_type, size_bytes, status, created_at}>>}
 */
export async function getDocuments(conversationId) {
  return apiJSON(`/conversations/${conversationId}/documents`);
}

/**
 * GET /conversations/:conversationId/documents/:docId
 * Returns full document metadata including a short-lived presigned URL for content.
 * Used when opening the document viewer.
 *
 * @param {string} conversationId
 * @param {string} docId
 * @returns {Promise<{ document_id, filename, file_type, content_url: string, ... }>}
 */
export async function getDocument(conversationId, docId) {
  return apiJSON(`/conversations/${conversationId}/documents/${docId}`);
}

/**
 * POST /conversations/:conversationId/documents/upload-url
 * Step 1 of two-step upload: get a presigned PUT URL from the backend.
 *
 * @param {string} conversationId
 * @param {{ filename: string, content_type: string, size: number }} meta
 * @returns {Promise<{ presigned_url: string, storage_key: string }>}
 */
export async function getUploadUrl(conversationId, meta) {
  return apiJSON(`/conversations/${conversationId}/documents/upload-url`, {
    method: 'POST',
    body: JSON.stringify(meta),
  });
}

/**
 * POST /conversations/:conversationId/documents
 * Step 2 of two-step upload: finalize upload and trigger ingestion.
 *
 * @param {string} conversationId
 * @param {{ storage_key: string, filename: string }} payload
 * @returns {Promise<{ document_id: string, status: string }>}
 */
export async function finalizeUpload(conversationId, payload) {
  return apiJSON(`/conversations/${conversationId}/documents`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * PUT /conversations/:conversationId/documents/:docId
 * Replace an existing document (same document_id, new storage_key).
 *
 * @param {string} conversationId
 * @param {string} docId
 * @param {{ storage_key: string, filename: string }} payload
 * @returns {Promise<{ document_id: string, status: string }>}
 */
export async function replaceDocument(conversationId, docId, payload) {
  return apiJSON(`/conversations/${conversationId}/documents/${docId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * DELETE /conversations/:conversationId/documents/:docId
 * Removes from object storage, Qdrant, and Postgres.
 *
 * @param {string} conversationId
 * @param {string} docId
 * @returns {Promise<void>}
 */
export async function deleteDocument(conversationId, docId) {
  return apiJSON(`/conversations/${conversationId}/documents/${docId}`, {
    method: 'DELETE',
  });
}

/**
 * Full two-step upload orchestration.
 * 1. Get presigned URL from backend
 * 2. PUT file directly to object storage
 * 3. Finalize (or replace) on backend
 *
 * @param {string} conversationId
 * @param {File} file
 * @param {{
 *   replace?: { docId: string },
 *   onProgress?: (pct: number) => void,
 *   signal?: AbortSignal,
 * }} options
 * @returns {Promise<{ document_id: string, status: string }>}
 */
export async function uploadDocument(conversationId, file, { replace, onProgress, signal } = {}) {
  // Step 1 — get presigned URL
  const { presigned_url, storage_key } = await getUploadUrl(conversationId, {
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    size: file.size,
  });

  // Step 2 — upload directly to object storage
  await uploadToStorage(presigned_url, file, { onProgress, signal });

  // Step 3 — finalize
  if (replace?.docId) {
    return replaceDocument(conversationId, replace.docId, {
      storage_key,
      filename: file.name,
    });
  }

  return finalizeUpload(conversationId, { storage_key, filename: file.name });
}
