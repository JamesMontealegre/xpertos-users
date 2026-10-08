import { Stack } from 'expo-router';

import { RedirectOnce } from '@/components/redirect-once';

import { colors } from '@/constants/theme';
import { homeFor } from '@/lib/home';
import { useAuth } from '@/providers/auth';

export default function AuthLayout() {
  const { session, profile, isApplicant } = useAuth();

  // Con sesión activa (y perfil cargado) el usuario no debe ver login/registro.
  if (session && profile) return <RedirectOnce href={homeFor(profile, isApplicant)} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
