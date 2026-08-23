import { useParams } from 'react-router-dom';
import { ConversationRow } from './ConversationRow.jsx';
import { useSidebar } from '../../store/SidebarContext.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import styles from './ConversationList.module.css';

/**
 * Scrollable list of conversation rows.
 * Hidden entirely when there are no conversations (per spec section 2).
 */
export function ConversationList() {
  const { conversations, isLoading } = useSidebar();
  const { conversationId } = useParams();

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size={18} label="Loading conversations…" />
      </div>
    );
  }

  if (!conversations.length) {
    return null; // Empty state: hide the section entirely
  }

  return (
    <nav aria-label="Conversations" className={styles.list} role="list">
      {conversations.map((conv) => (
        <ConversationRow
          key={conv.conversation_id}
          conversation={conv}
          isActive={conv.conversation_id === conversationId}
        />
      ))}
    </nav>
  );
}
