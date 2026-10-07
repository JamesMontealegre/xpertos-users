import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import { Loading } from '@/components/ui/screen';
import type { Enums } from '@/lib/database.types';
import { useAuth } from '@/providers/auth';

/**
 * Protege un grupo de rutas: sin sesión → login; con rol distinto → su propio panel.
 * Devuelve el contenido a renderizar en lugar del grupo (o null si todo está bien).
 */
export function useRoleGuard(allowed: Enums<'user_role'>[]): ReactNode | null {
  const { session, profile, loading } = useAuth();

  if (loading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile) return <Loading message="Preparando tu perfil…" />;
  if (!allowed.includes(profile.role)) return <Redirect href="/" />;
  return null;
}
