import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Profile = Tables<'profiles'>;

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  /** true cuando la cuenta tiene una postulación de experto: es aspirante, no cliente. */
  isApplicant: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type Account = { profile: Profile | null; isApplicant: boolean };

async function fetchAccount(userId: string, email: string | undefined): Promise<Account> {
  const [profileResult, applicationResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('expert_applications')
      .select('id')
      .or(email ? `user_id.eq.${userId},email.ilike.${email}` : `user_id.eq.${userId}`)
      .limit(1)
      .maybeSingle(),
  ]);
  if (profileResult.error) {
    console.warn('No se pudo cargar el perfil', profileResult.error.message);
  }
  if (applicationResult.error) {
    console.warn('No se pudo consultar la postulación', applicationResult.error.message);
  }
  return { profile: profileResult.data ?? null, isApplicant: Boolean(applicationResult.data) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account>({ profile: null, isApplicant: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        setAccount(await fetchAccount(data.session.user.id, data.session.user.email));
      }
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setAccount({ profile: null, isApplicant: false });
        setLoading(false);
        return;
      }
      // Evitamos await directo dentro del callback (recomendación de supabase-js).
      setTimeout(async () => {
        const next = await fetchAccount(nextSession.user.id, nextSession.user.email);
        if (active) {
          setAccount(next);
          setLoading(false);
        }
      }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    setAccount(await fetchAccount(session.user.id, session.user.email));
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAccount({ profile: null, isApplicant: false });
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile: account.profile,
      isApplicant: account.isApplicant,
      loading,
      refreshProfile,
      signOut,
    }),
    [session, account, loading, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
