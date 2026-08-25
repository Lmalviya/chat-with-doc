import { apiJSON, uploadToStorage } from './client.js';

/**
 * GET /conversations/:conversationId/documents
 * Returns document metadata list.
 *
 * @param {string} conversationId
 * @returns {Promise<Array<{document_id, filename, file_type, size_bytes, file_status, file_ingestion_status, created_at}>>}
 */
export async function getDocuments(conversationId) {
  const data = await apiJSON(`/conversations/${conversationId}/documents/`);
  const rawDocs = data?.documents ?? (Array.isArray(data) ? data : []);
  return rawDocs.map((d) => ({
    ...d,
    document_id: d.id ?? d.document_id,
    filename: d.file_name ?? d.filename,
    file_type: d.file_type,
    size_bytes: d.file_bytes ?? d.size_bytes,
    status: d.file_status ?? d.status,
    ingestion_status: d.file_ingestion_status,
  }));
}

/**
 * GET /conversations/:conversationId/documents/:docId
 * Returns metadata for a single document.
 *
 * @param {string} conversationId
 * @param {string} docId
 * @returns {Promise<{ document_id, filename, file_type, size_bytes, status, ... }>}
 */
export async function getDocument(conversationId, docId) {
  const d = await apiJSON(`/conversations/${conversationId}/documents/${docId}`);
  return {
    ...d,
    document_id: d.id ?? d.document_id,
    filename: d.file_name ?? d.filename,
    file_type: d.file_type,
    size_bytes: d.file_bytes ?? d.size_bytes,
    status: d.file_status ?? d.status,
  };
}

/**
 * GET /conversations/:conversationId/documents/:docId/download-url
 * Returns a short-lived presigned GET URL for viewing / downloading the file directly from Cloudflare R2.
 *
 * @param {string} conversationId
 * @param {string} docId
 * @returns {Promise<{ download_url: string, file_name: string }>}
 */
export async function getDocumentDownloadUrl(conversationId, docId) {
  return apiJSON(`/conversations/${conversationId}/documents/${docId}/download-url`);
}

/**
 * POST /conversations/:conversationId/documents/presign
 * Step 1 of two-step upload: validate file & get presigned PUT URL for Cloudflare R2.
 *
 * @param {string} conversationId
 * @param {{ file_name: string, file_type: string, file_bytes: number, file_hash?: string }} meta
 * @returns {Promise<{ document_id: string, upload_url: string, file_path: string, is_duplicate: boolean, file_status: string }>}
 */
export async function getUploadPresignedUrl(conversationId, meta) {
  return apiJSON(`/conversations/${conversationId}/documents/presign`, {
    method: 'POST',
    body: JSON.stringify(meta),
  });
}

/**
 * POST /conversations/:conversationId/documents/:docId/confirm
 * Step 2 of two-step upload: confirm upload completed to R2 and mark status 'ready'.
 *
 * @param {string} conversationId
 * @param {string} docId
 * @returns {Promise<{ document_id: string, file_status: string }>}
 */
export async function confirmDocumentUpload(conversationId, docId) {
  return apiJSON(`/conversations/${conversationId}/documents/${docId}/confirm`, {
    method: 'POST',
  });
}

/**
 * DELETE /conversations/:conversationId/documents/:docId
 * Deletes document from Cloudflare R2 and PostgreSQL.
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
 * DELETE /conversations/:conversationId/documents/batch
 * Bulk deletes multiple documents from Cloudflare R2 and PostgreSQL.
 *
 * @param {string} conversationId
 * @param {string[]} documentIds
 * @returns {Promise<string[]>}
 */
export async function deleteDocumentsBatch(conversationId, documentIds) {
  return apiJSON(`/conversations/${conversationId}/documents/batch`, {
    method: 'DELETE',
    body: JSON.stringify({ document_ids: documentIds }),
  });
}

/**
 * PATCH /conversations/:conversationId/documents/batch
 * Bulk updates ingestion status for multiple documents.
 *
 * @param {string} conversationId
 * @param {{ document_ids: string[], file_status?: string, file_ingestion_status?: string }} payload
 * @returns {Promise<Array>}
 */
export async function updateDocumentsBatch(conversationId, payload) {
  return apiJSON(`/conversations/${conversationId}/documents/batch`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Full two-step direct-to-storage upload orchestration:
 * 1. Request presigned PUT URL from backend
 * 2. PUT file bytes directly from browser to Cloudflare R2
 * 3. Confirm upload on backend
 *
 * @param {string} conversationId
 * @param {File} file
 * @param {{
 *   onProgress?: (pct: number) => void,
 *   signal?: AbortSignal,
 * }} options
 * @returns {Promise<{ document_id: string, status: string, filename: string }>}
 */
export async function uploadDocument(conversationId, file, { onProgress, signal } = {}) {
  // Step 1 — Get presigned upload URL
  const presignData = await getUploadPresignedUrl(conversationId, {
    file_name: file.name,
    file_type: file.type || 'application/octet-stream',
    file_bytes: file.size,
  });

  // Step 2 — Upload directly to Cloudflare R2 via HTTP PUT
  await uploadToStorage(presignData.upload_url, file, { onProgress, signal });

  // Step 3 — Confirm upload on backend
  const confirmedDoc = await confirmDocumentUpload(conversationId, presignData.document_id);

  return {
    document_id: presignData.document_id,
    status: confirmedDoc.file_status || 'ready',
    filename: file.name,
  };
}
