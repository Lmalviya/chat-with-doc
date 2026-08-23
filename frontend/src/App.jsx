import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { LandingView } from './components/chat/LandingView.jsx';
import { ChatView } from './components/chat/ChatView.jsx';
import { SidebarProvider } from './store/SidebarContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';

/**
 * Root application component.
 *
 * Routes:
 *  /                   → LandingView (empty state / new chat)
 *  /c/:conversationId  → ChatView    (active conversation)
 *  *                   → redirect to /
 *
 * SidebarProvider wraps everything so the sidebar persists across navigation
 * without re-mounting or re-fetching.
 */
export default function App() {
  return (
    <BrowserRouter>
      <SidebarProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<LandingView />} />
            <Route path="/c/:conversationId" element={<ChatView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <ToastProvider />
      </SidebarProvider>
    </BrowserRouter>
  );
}
