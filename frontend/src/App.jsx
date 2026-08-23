import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext.jsx';
import { SidebarProvider } from './store/SidebarContext.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { LandingView } from './components/chat/LandingView.jsx';
import { ChatView } from './components/chat/ChatView.jsx';
import { LoginView } from './components/auth/LoginView.jsx';
import { SignupView } from './components/auth/SignupView.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';

/**
 * Root application component with Supabase Auth protection.
 *
 * Public Routes:
 *  /login  → LoginView
 *  /signup → SignupView
 *
 * Protected Routes:
 *  /                   → LandingView (empty state / new chat)
 *  /c/:conversationId  → ChatView    (active conversation)
 *  *                   → redirect to /
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SidebarProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginView />} />
            <Route path="/signup" element={<SignupView />} />

            {/* Protected Application Workspace */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<LandingView />} />
                <Route path="/c/:conversationId" element={<ChatView />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
          <ToastProvider />
        </SidebarProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
