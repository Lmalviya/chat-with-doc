/** Shared constants used across the application */

/** Maximum file size per upload: 10 MB */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Human-readable max file size label */
export const MAX_FILE_SIZE_LABEL = '10 MB';

/** Maximum documents per conversation */
export const MAX_DOCS_PER_CONVERSATION = 10;

/** Allowed file extensions */
export const SUPPORTED_EXTENSIONS = new Set([
  '.pdf',
  '.txt',
  '.md',
  '.py',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.java',
  '.go',
  '.rs',
  '.cpp',
  '.c',
  '.h',
  '.rb',
  '.php',
  '.cs',
  '.swift',
  '.kt',
  '.scala',
  '.r',
  '.sql',
  '.sh',
  '.yaml',
  '.yml',
  '.json',
  '.toml',
  '.ini',
  '.env',
  '.xml',
  '.html',
  '.css',
]);

/** Allowed MIME types (paired with extension validation) */
export const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/x-python',
  'application/x-python-code',
  'text/javascript',
  'application/javascript',
  'text/typescript',
  'text/x-java-source',
  'text/x-go',
  'text/x-rustsrc',
  'text/x-c++src',
  'text/x-csrc',
  'text/x-ruby',
  'text/x-php',
  'text/x-csharp',
  'text/x-swift',
  'text/x-kotlin',
  'text/x-scala',
  'text/x-rsrc',
  'application/sql',
  'text/x-sql',
  'text/x-sh',
  'text/x-shellscript',
  'application/x-yaml',
  'text/yaml',
  'application/json',
  'application/toml',
  'text/html',
  'text/css',
  'application/xml',
  'text/xml',
  // Generic fallback — many editors save code as text/plain
  'application/octet-stream',
]);

/** Message status values (mirrors DB CHECK constraint) */
export const MESSAGE_STATUS = {
  STREAMING: 'streaming',
  COMPLETE: 'complete',
  STOPPED: 'stopped',
  FAILED: 'failed',
};

/** Document status values (mirrors DB CHECK constraint) */
export const DOC_STATUS = {
  UPLOADING: 'uploading',
  READY: 'ready',
  FAILED: 'failed',
};

/** How often to poll document status when uploading (ms) */
export const DOC_POLL_INTERVAL_MS = 2500;

/** Sidebar width in pixels (matches --sidebar-width token) */
export const SIDEBAR_WIDTH_PX = 260;

/** Milliseconds to debounce title fetch after first reply completes */
export const TITLE_GENERATION_DELAY_MS = 500;
