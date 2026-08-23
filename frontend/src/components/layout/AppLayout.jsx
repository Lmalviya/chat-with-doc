import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import styles from './AppLayout.module.css';

/**
 * Root layout: sidebar (left) + main content area (right).
 * Both share full viewport height.
 */
export function AppLayout() {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main} id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
