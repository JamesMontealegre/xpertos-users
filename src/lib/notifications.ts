import type { Href } from 'expo-router';

import { homeFor } from '@/lib/home';
import type { Profile } from '@/providers/auth';

/**
 * Ruta de la app a la que lleva un aviso. La base guarda rutas cortas ("/", "/application",
 * "/service/<id>"); el inicio y la postulación se resuelven a rutas explícitas para no caer en el
 * index de otro grupo.
 */
export function notificationHref(link: string | null, profile: Profile | null, isApplicant: boolean): Href | null {
  if (!link || link === '/') return profile ? homeFor(profile, isApplicant) : null;
  if (link === '/application') return '/(applicant)/application';
  return link as Href;
}
