import type { RealtimeChannel } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

export type AppNotification = Tables<'notifications'>;

type NotificationsContextValue = {
  /** false sin sesión o para agentes (operan desde el panel web). */
  enabled: boolean;
  items: AppNotification[];
  unread: number;
  /** El último aviso que llegó en tiempo real (para el aviso emergente y para recargar pantallas). */
  latest: AppNotification | null;
  dismissLatest: () => void;
  /** Escucha los avisos nuevos (p. ej. para recargar una pantalla); devuelve la función para dejar de escuchar. */
  subscribe: (listener: (n: AppNotification) => void) => () => void;
  reload: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  /** Devuelve false si no se pudieron marcar en la base. */
  markAllRead: () => Promise<boolean>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

const PAGE_SIZE = 50;

async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (error) {
    console.warn('No se pudieron cargar las notificaciones', error.message);
    return null;
  }
  return data ?? [];
}

/**
 * Buzón de avisos del usuario (mensajes del agente sobre su postulación y sus servicios).
 * La base crea un aviso por cada correo que le enviamos; aquí se cargan los últimos y se escuchan los
 * nuevos en tiempo real. Al volver a la app se recarga por si la conexión se cortó.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user.id ?? null;
  // La lista guarda de quién es: al cambiar de cuenta no se muestran los avisos de la anterior.
  const [state, setState] = useState<{ owner: string | null; items: AppNotification[] }>({ owner: null, items: [] });
  const [latestRow, setLatest] = useState<AppNotification | null>(null);
  const listeners = useRef(new Set<(n: AppNotification) => void>());
  const refreshProfileRef = useRef(refreshProfile);
  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  // Los agentes no reciben avisos en la app (tienen el panel).
  const enabled = Boolean(userId) && profile?.role !== 'admin';
  const items = useMemo(() => (enabled && state.owner === userId ? state.items : []), [enabled, state, userId]);
  const latest = enabled && latestRow?.user_id === userId ? latestRow : null;
  const setItems = useCallback(
    (update: (list: AppNotification[]) => AppNotification[]) =>
      setState((current) => ({ owner: current.owner, items: update(current.items) })),
    []
  );

  const reload = useCallback(async () => {
    if (!userId) return;
    const data = await fetchNotifications(userId);
    if (data) setState({ owner: userId, items: data });
  }, [userId]);

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    void fetchNotifications(userId).then((data) => {
      if (!cancelled && data) setState({ owner: userId, items: data });
    });

    // Primero el token de la sesión y luego la suscripción: sin él, Realtime suscribe como anónimo y
    // las reglas de la base no envían nada.
    let channel: RealtimeChannel | null = null;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`notificaciones:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as AppNotification;
            setItems((list) => [row, ...list.filter((n) => n.id !== row.id)].slice(0, PAGE_SIZE));
            setLatest(row);
            listeners.current.forEach((listener) => listener(row));
            // Aprobado como experto: el perfil cambia de rol y la app pasa al panel de experto.
            if (row.kind === 'application_approved') void refreshProfileRef.current();
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as AppNotification;
            setItems((list) => list.map((n) => (n.id === row.id ? row : n)));
          }
        )
        .subscribe();
    })();

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void reload();
    });

    return () => {
      cancelled = true;
      appState.remove();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, userId, reload, setItems]);

  const subscribe = useCallback((listener: (n: AppNotification) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    const readAt = new Date().toISOString();
    setItems((list) => list.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: readAt } : n)));
    const { error } = await supabase.from('notifications').update({ read_at: readAt }).eq('id', id).is('read_at', null);
    if (error) console.warn('No se pudo marcar la notificación', error.message);
  }, [setItems]);

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: readAt })));
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) console.warn('No se pudieron marcar las notificaciones', error.message);
    return !error;
  }, [setItems]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      enabled,
      items,
      unread: items.filter((n) => !n.read_at).length,
      latest,
      dismissLatest: () => setLatest(null),
      subscribe,
      reload,
      markRead,
      markAllRead,
    }),
    [enabled, items, latest, subscribe, reload, markRead, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications debe usarse dentro de NotificationsProvider');
  return ctx;
}
