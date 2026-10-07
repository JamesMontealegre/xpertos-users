import { Redirect, Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { useAuth } from '@/providers/auth';

export default function AuthLayout() {
  const { session, profile } = useAuth();

  // Con sesión activa (y perfil cargado) el usuario no debe ver login/registro.
  if (session && profile) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
