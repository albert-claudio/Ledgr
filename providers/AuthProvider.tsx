import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { OAuthProvider, signInWithOAuth as oauthLogin, signOut as oauthSignOut } from '@/lib/auth';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  initializing: boolean;
  signInWithOAuth: (provider: OAuthProvider, scopes?: string[]) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    initializing,
    async signInWithOAuth(provider, scopes) {
      await oauthLogin(provider, scopes);
    },
    async signOut() {
      await oauthSignOut();
    },
  }), [user, session, initializing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

