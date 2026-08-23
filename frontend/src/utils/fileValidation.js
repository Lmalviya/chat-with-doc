import { SUPPORTED_EXTENSIONS, SUPPORTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from './constants.js';

/**
 * Validate a File object before upload.
 * Checks both extension and MIME type (defence-in-depth — server re-validates).
 *
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFile(file) {
  const ext = getExtension(file.name);

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File type "${ext || 'unknown'}" is not supported. Allowed: PDF, text, markdown, and common code files.`,
    };
  }

  // Many OS-assigned MIME types are unreliable so we allow octet-stream as fallback
  if (file.type && !SUPPORTED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `MIME type "${file.type}" is not allowed for file "${file.name}".`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `"${file.name}" exceeds the ${MAX_FILE_SIZE_LABEL} limit (file is ${formatFileSize(file.size)}).`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: `"${file.name}" is empty.` };
  }

  return { valid: true };
}

/**
 * Extract the lowercase extension including the dot.
 * @param {string} filename
 * @returns {string} e.g. '.pdf'
 */
export function getExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Format a byte count as a human-readable string.
 * @param {number} bytes
 * @returns {string} e.g. '4.2 MB'
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

/**
 * Map a file extension to a display-friendly language label (used in the document viewer).
 * @param {string} ext - lowercase extension with dot
 * @returns {string}
 */
export function extToLanguage(ext) {
  const map = {
    '.py':    'python',
    '.js':    'javascript',
    '.jsx':   'javascript',
    '.ts':    'typescript',
    '.tsx':   'typescript',
    '.java':  'java',
    '.go':    'go',
    '.rs':    'rust',
    '.cpp':   'cpp',
    '.c':     'c',
    '.h':     'c',
    '.rb':    'ruby',
    '.php':   'php',
    '.cs':    'csharp',
    '.swift': 'swift',
    '.kt':    'kotlin',
    '.scala': 'scala',
    '.r':     'r',
    '.sql':   'sql',
    '.sh':    'bash',
    '.yaml':  'yaml',
    '.yml':   'yaml',
    '.json':  'json',
    '.toml':  'toml',
    '.xml':   'xml',
    '.html':  'html',
    '.css':   'css',
    '.md':    'markdown',
    '.txt':   'plaintext',
    '.pdf':   'pdf',
  };
  return map[ext] ?? 'plaintext';
}

/**
 * Returns a short icon label for a file type (used in document rows).
 * @param {string} ext
 * @returns {string}
 */
export function getFileTypeLabel(ext) {
  if (ext === '.pdf') return 'PDF';
  if (ext === '.md') return 'MD';
  if (ext === '.txt') return 'TXT';
  return ext.replace('.', '').toUpperCase().slice(0, 4);
}
