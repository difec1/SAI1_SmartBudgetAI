'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase-browser';

type AuthState = {
  session: Session | null | undefined;
  user: User | null;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null };
}

/**
 * Redirects to /login when no active session exists.
 * Returns session/user so components can fetch with the access token.
 */
export function useRequireAuth(): AuthState {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.session === null) {
      router.replace('/login');
    }
  }, [auth.session, router]);

  return auth;
}
