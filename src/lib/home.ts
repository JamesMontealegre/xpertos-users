import type { Href } from 'expo-router';

import type { Profile } from '@/providers/auth';

/**
 * Pantalla inicial según el tipo de cuenta. Una cuenta es cliente O aspirante/experto, nunca ambas;
 * el admin entra a /admin: el superadmin elige la vista y el agente ve el enlace al panel.
 *
 * Se usa una ruta absoluta y explícita: redirigir a "/" desde dentro de un grupo resuelve al
 * index de ese grupo y provoca bucles.
 */
export function homeFor(profile: Profile, isApplicant: boolean): Href {
  switch (profile.role) {
    case 'admin':
      return '/admin';
    case 'expert':
      return '/(expert)/assigned';
    default:
      return isApplicant ? '/(applicant)/application' : '/(client)';
  }
}
