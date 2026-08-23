import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconTrash, IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import { formatRelativeDate, formatAbsoluteDate } from '../../utils/formatDate.js';
import { useSidebar } from '../../store/SidebarContext.jsx';
import styles from './ConversationRow.module.css';

/**
 * Single conversation row in the sidebar list.
 *
 * Hover reveals delete (with inline confirm) and rename (inline input) actions.
 *
 * @param {{
 *   conversation: { conversation_id, title, updated_at },
 *   isActive: boolean,
 * }} props
 */
export function ConversationRow({ conversation, isActive }) {
  const navigate = useNavigate();
  const { removeConversation, renameConversation } = useSidebar();

  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  const displayTitle = conversation.title || 'New conversation';

  function handleClick() {
    if (editing || confirmDelete) return;
    navigate(`/c/${conversation.conversation_id}`);
  }

  function startEdit(e) {
    e.stopPropagation();
    setEditValue(displayTitle);
    setEditing(true);
    setConfirmDelete(false);
    setTimeout(() => inputRef.current?.select(), 10);
  }

  function cancelEdit() {
    setEditing(false);
    setEditValue('');
  }

  async function saveEdit() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === displayTitle) { cancelEdit(); return; }
    setEditing(false);
    await renameConversation(conversation.conversation_id, trimmed);
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }

  function startDelete(e) {
    e.stopPropagation();
    setConfirmDelete(true);
    setEditing(false);
  }

  function cancelDelete(e) {
    e.stopPropagation();
    setConfirmDelete(false);
  }

  function confirmDeleteAction(e) {
    e.stopPropagation();
    removeConversation(conversation.conversation_id);
    if (isActive) navigate('/');
  }

  return (
    <div
      className={`${styles.row} ${isActive ? styles.active : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}
      role="listitem"
    >
      {editing ? (
        <div className={styles.editRow} onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            className={styles.editInput}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            aria-label="Rename conversation"
            autoFocus
          />
          <button
            className={styles.iconBtn}
            onClick={saveEdit}
            aria-label="Save rename"
            title="Save"
          >
            <IconCheck size={14} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={cancelEdit}
            aria-label="Cancel rename"
            title="Cancel"
          >
            <IconX size={14} />
          </button>
        </div>
      ) : confirmDelete ? (
        <div className={styles.confirmRow} onClick={(e) => e.stopPropagation()}>
          <span className={styles.confirmText}>Delete?</span>
          <button
            className={`${styles.iconBtn} ${styles.danger}`}
            onClick={confirmDeleteAction}
            aria-label="Confirm delete conversation"
          >
            <IconCheck size={14} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={cancelDelete}
            aria-label="Cancel delete"
          >
            <IconX size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className={styles.content}>
            <span className={styles.title}>{displayTitle}</span>
            <time
              className={styles.time}
              dateTime={conversation.updated_at}
              title={formatAbsoluteDate(conversation.updated_at)}
            >
              {formatRelativeDate(conversation.updated_at)}
            </time>
          </div>

          {hovered && (
            <div className={styles.actions}>
              <button
                className={styles.iconBtn}
                onClick={startEdit}
                aria-label="Rename conversation"
              >
                <IconPencil size={14} />
              </button>
              <button
                className={`${styles.iconBtn} ${styles.danger}`}
                onClick={startDelete}
                aria-label="Delete conversation"
              >
                <IconTrash size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
