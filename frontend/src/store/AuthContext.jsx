import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabase.js';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Check initial active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // 2. Listen to all auth state changes (login, logout, token refresh, OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);

    if (error) {
      toast.error(error.message || 'Login failed. Please check your credentials.');
      throw error;
    }

    toast.success('Welcome back!');
    return data;
  };

  const signup = async (email, password, name) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name || '',
          name: name || '',
        },
      },
    });
    setIsLoading(false);

    if (error) {
      toast.error(error.message || 'Sign up failed.');
      throw error;
    }

    if (data?.session) {
      toast.success('Account created successfully!');
    } else if (data?.user && !data.session) {
      toast.success('Registration successful! Please check your email to verify your account.');
    }

    return data;
  };

  const loginWithOAuth = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(`Could not log in with ${provider}: ${error.message}`);
      throw error;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signOut();
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Logged out successfully.');
    }
  };

  const value = {
    session,
    user,
    token: session?.access_token || null,
    isAuthenticated: Boolean(session?.user),
    isLoading,
    login,
    signup,
    loginWithOAuth,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
