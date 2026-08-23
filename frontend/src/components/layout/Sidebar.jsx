import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconLogout } from '@tabler/icons-react';
import { ConversationList } from '../sidebar/ConversationList.jsx';
import { ThemeSwitcher } from '../sidebar/ThemeSwitcher.jsx';
import { useSidebar } from '../../store/SidebarContext.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import styles from './Sidebar.module.css';

/**
 * Full sidebar: fixed left panel with new-chat, conversation list,
 * user profile footer with logout, and theme switcher.
 */
export function Sidebar() {
  const navigate = useNavigate();
  const { loadConversations } = useSidebar();
  const { user, logout } = useAuth();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  function handleNewChat() {
    navigate('/');
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';
  const initial = (displayName[0] || 'U').toUpperCase();

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
      </div>

      {/* Conversation list — scrollable middle section */}
      <div className={styles.listArea}>
        <ConversationList />
      </div>

      {/* User profile & controls footer */}
      <div className={styles.bottom}>
        <div className={styles.userRow}>
          <div className={styles.userInfo} title={displayEmail}>
            <div className={styles.avatar}>{initial}</div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{displayName}</span>
              {displayEmail && <span className={styles.userEmail}>{displayEmail}</span>}
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={logout}
            title="Log out"
            aria-label="Log out"
          >
            <IconLogout size={16} stroke={1.75} />
          </button>
        </div>

        <div className={styles.controlsRow}>
          <ThemeSwitcher />
        </div>
      </div>
    </aside>
  );
}
