import { RedirectOnce } from '@/components/redirect-once';
import { Loading } from '@/components/ui/screen';
import { homeFor } from '@/lib/home';
import { useAuth } from '@/providers/auth';

/** Punto de entrada: redirige según sesión y tipo de cuenta. */
export default function Index() {
  const { session, profile, isApplicant, loading } = useAuth();

  if (loading) return <Loading />;
  if (!session) return <RedirectOnce href="/(auth)/login" />;
  if (!profile) return <Loading message="Preparando tu perfil…" />;

  return <RedirectOnce href={homeFor(profile, isApplicant)} />;
}
