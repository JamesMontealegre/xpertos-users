import type { ReactNode } from 'react';

import { RedirectOnce } from '@/components/redirect-once';
import { Loading } from '@/components/ui/screen';
import type { Enums } from '@/lib/database.types';
import { homeFor } from '@/lib/home';
import { useAuth } from '@/providers/auth';

type Options = {
  /** Para rol client: true exige ser aspirante (con postulación); false exige NO serlo. */
  applicant?: boolean;
  /** Deja pasar a los agentes (admin sin marca de superadmin). Solo la pantalla /admin lo usa. */
  agents?: boolean;
};

/**
 * Protege un grupo de rutas: sin sesión → login; con otro tipo de cuenta → su propio inicio.
 * Devuelve el contenido a renderizar en lugar del grupo (o null si todo está bien).
 */
export function useRoleGuard(allowed: Enums<'user_role'>[], options: Options = {}): ReactNode | null {
  const { session, profile, isApplicant, loading } = useAuth();

  if (loading) return <Loading />;
  if (!session) return <RedirectOnce href="/(auth)/login" />;
  if (!profile) return <Loading message="Preparando tu perfil…" />;

  // Los agentes operan desde el panel web; solo el superadmin entra a las vistas de la app.
  const isAgent = profile.role === 'admin' && !profile.is_super_admin;
  const roleOk = allowed.includes(profile.role) && (!isAgent || options.agents === true);
  const applicantOk =
    profile.role !== 'client' || options.applicant === undefined || options.applicant === isApplicant;

  if (!roleOk || !applicantOk) return <RedirectOnce href={homeFor(profile, isApplicant)} />;
  return null;
}
