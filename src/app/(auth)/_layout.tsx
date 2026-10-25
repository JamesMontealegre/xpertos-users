import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { useState } from 'react';

import { RedirectOnce } from '@/components/redirect-once';

import { colors } from '@/constants/theme';
import { NEXT_NEW_SERVICE, afterAuthHref } from '@/lib/home';
import { useAuth } from '@/providers/auth';

export default function AuthLayout() {
  const { session, profile, isApplicant } = useAuth();
  const { next } = useGlobalSearchParams<{ next?: string }>();
  const pathname = usePathname();

  // Venía a pedir un servicio (/solicitar o ?next=nuevo). Se recuerda mientras está en este grupo: al redirigir,
  // la ruta cambia antes de salir y el destino no debe cambiar con ella.
  const wantsNew = pathname === '/solicitar' || next === NEXT_NEW_SERVICE;
  const [requestingService, setRequestingService] = useState(wantsNew);
  if (wantsNew && !requestingService) setRequestingService(true);

  // Con sesión activa (y perfil cargado) el usuario no debe ver login/registro; si venía a pedir un servicio,
  // llega directo a "Nuevo servicio".
  if (session && profile) return <RedirectOnce href={afterAuthHref(profile, isApplicant, requestingService)} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
