/**
 * Base API client with Supabase JWT Bearer token authentication.
 *
 * All requests:
 *  - Prepend VITE_BACKEND_API_BASE_URL + '/api/v1' (default: http://localhost:8000/api/v1)
 *  - Attach 'Authorization: Bearer <token>' from active Supabase session
 *  - Support X-Request-Id header for idempotency correlation
 */

import { supabase } from './supabase.js';

const RAW_BASE =
  (import.meta.env.VITE_BACKEND_API_BASE_URL ?? '').replace(/\/$/, '');

const BASE_URL = RAW_BASE
  ? (RAW_BASE.endsWith('/api/v1') ? RAW_BASE : `${RAW_BASE}/api/v1`)
  : '/api/v1';

/**
 * Retrieve the current active Supabase access token (JWT).
 * @returns {Promise<string|null>}
 */
export async function getAuthToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Generic fetch wrapper.
 *
 * @param {string} path - e.g. '/conversations'
 * @param {RequestInit & { requestId?: string }} options
 * @returns {Promise<Response>} raw Response
 */
export async function apiFetch(path, options = {}) {
  const { requestId, headers: extraHeaders, ...rest } = options;
  const token = await getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(requestId ? { 'X-Request-Id': requestId } : {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extraHeaders,
  };

  // Remove Content-Type for FormData / raw binary uploads
  if (rest.body instanceof FormData || rest.body instanceof ArrayBuffer || rest.body instanceof Blob) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
  });

  return response;
}

/**
 * JSON fetch helper — parses the response body and throws on non-2xx.
 *
 * @param {string} path
 * @param {RequestInit & { requestId?: string }} options
 * @returns {Promise<any>}
 */
export async function apiJSON(path, options = {}) {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body.detail ?? body.message ?? message;
    } catch {
      // ignore parse error
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  // 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

/**
 * Upload a file directly to a presigned URL.
 */
export function uploadToStorage(presignedUrl, file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage upload failed: HTTP ${xhr.status}`));
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new DOMException('Upload aborted', 'AbortError')));

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(file);
  });
}

export { BASE_URL };
