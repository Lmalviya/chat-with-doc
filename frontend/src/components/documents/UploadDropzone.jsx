import { useRef, useState } from 'react';
import { IconUpload, IconFile } from '@tabler/icons-react';
import { validateFile } from '../../utils/fileValidation.js';
import { MAX_FILE_SIZE_LABEL, MAX_DOCS_PER_CONVERSATION } from '../../utils/constants.js';
import styles from './UploadDropzone.module.css';

/**
 * Drag-and-drop file upload zone.
 *
 * @param {{
 *   onFiles: (files: File[]) => void,
 *   disabled?: boolean,
 * }} props
 */
export function UploadDropzone({ onFiles, disabled = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState([]);

  function processFiles(fileList) {
    const files = Array.from(fileList);
    const valid = [];
    const errs = [];

    for (const file of files) {
      const result = validateFile(file);
      if (result.valid) valid.push(file);
      else errs.push(result.error);
    }

    if (errs.length) setErrors(errs);
    else setErrors([]);

    if (valid.length) onFiles(valid);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    processFiles(e.dataTransfer.files);
  }

  function handleChange(e) {
    if (disabled) return;
    processFiles(e.target.files);
    e.target.value = ''; // allow re-selecting the same file
  }

  return (
    <div className={styles.root}>
      <div
        className={`${styles.zone} ${dragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        aria-label="Upload document — click or drag a file here"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      >
        <IconUpload size={22} className={styles.icon} />
        <span className={styles.primary}>Drop file here or <u>browse</u></span>
        <span className={styles.secondary}>
          Max {MAX_FILE_SIZE_LABEL} · Up to {MAX_DOCS_PER_CONVERSATION} docs · PDF, TXT, MD, code files
        </span>
        <input
          ref={inputRef}
          type="file"
          className={styles.input}
          accept=".pdf,.txt,.md,.py,.js,.ts,.jsx,.tsx,.java,.go,.rs,.cpp,.c,.h,.rb,.php,.cs,.swift,.kt,.scala,.r,.sql,.sh,.yaml,.yml,.json,.toml,.xml,.html,.css"
          multiple
          onChange={handleChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {errors.map((err, i) => (
        <p key={i} className={styles.error} role="alert">{err}</p>
      ))}
    </div>
  );
}
