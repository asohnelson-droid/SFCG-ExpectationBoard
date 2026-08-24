import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function syncUserProfile(user: User) {
  try {
    await supabase.from('users').upsert(
      {
        id: user.id,
        email: user.email ?? null,
        display_name: (user.user_metadata?.full_name || user.user_metadata?.name) ?? null,
        photo_url: (user.user_metadata?.avatar_url || user.user_metadata?.picture) ?? null,
        last_login: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch (error) {
    console.error('Error syncing user profile:', error);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Google sign-in errors (e.g. the user cancels, or the OAuth app isn't
    // configured) come back as query/hash params on the redirect, since this
    // flow navigates away instead of using a popup.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const errorDescription =
      hashParams.get('error_description') || queryParams.get('error_description') || queryParams.get('error');
    if (errorDescription) {
      setAuthError(decodeURIComponent(errorDescription));
      window.history.replaceState({}, '', window.location.pathname);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);
      if (currentUser) syncUserProfile(currentUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);
      if (currentUser) syncUserProfile(currentUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) {
        setAuthError(`Sign-in failed: ${error.message}`);
      }
      // On success the browser navigates to Google and back — there's
      // nothing further to do here.
    } catch (error: any) {
      setAuthError(`Sign-in failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isSigningIn, authError, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
