import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus } from '@tabler/icons-react';
import { ConversationList } from '../sidebar/ConversationList.jsx';
import { ThemeSwitcher } from '../sidebar/ThemeSwitcher.jsx';
import { useSidebar } from '../../store/SidebarContext.jsx';
import styles from './Sidebar.module.css';

/**
 * Full sidebar: fixed left panel with new-chat, conversation list,
 * 24-hour notice, and theme switcher.
 */
export function Sidebar() {
  const navigate = useNavigate();
  const { loadConversations } = useSidebar();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  function handleNewChat() {
    navigate('/');
  }

  return (
    <aside className={styles.sidebar} aria-label="Sidebar">
      {/* Top section */}
      <div className={styles.top}>
        <button
          id="new-chat-btn"
          className={styles.newChatBtn}
          onClick={handleNewChat}
          aria-label="Start a new chat"
        >
          <IconPlus size={18} stroke={2} />
          <span>New chat</span>
        </button>

        {/* Session retention notice — always visible, not dismissible */}
        <p className={styles.sessionNotice} aria-live="off">
          Chats are kept for 24 hours
        </p>
      </div>

      {/* Conversation list — scrollable middle section */}
      <div className={styles.listArea}>
        <ConversationList />
      </div>

      {/* Theme switcher — pinned to bottom, not part of the scrollable list */}
      <div className={styles.bottom}>
        <ThemeSwitcher />
      </div>
    </aside>
  );
}
