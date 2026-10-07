import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui/screen';
import { useAuth } from '@/providers/auth';

/** Punto de entrada: redirige según sesión y rol. */
export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile) return <Loading message="Preparando tu perfil…" />;

  switch (profile.role) {
    case 'admin':
      return <Redirect href="/admin" />;
    case 'expert':
      return <Redirect href="/(expert)/assigned" />;
    default:
      return <Redirect href="/(client)" />;
  }
}
