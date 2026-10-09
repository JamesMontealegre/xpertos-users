import {
  Mulish_400Regular,
  Mulish_400Regular_Italic,
  Mulish_500Medium,
  Mulish_600SemiBold,
  Mulish_700Bold,
  Mulish_800ExtraBold,
  Mulish_900Black,
  useFonts,
} from '@expo-google-fonts/mulish';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { NotificationToast } from '@/components/notifications/notification-toast';
import { Loading } from '@/components/ui/screen';
import { UpdateWatcher } from '@/components/update-watcher';
import { colors, fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/auth';
import { NotificationsProvider } from '@/providers/notifications';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: 'normal' as const },
    medium: { fontFamily: fonts.medium, fontWeight: 'normal' as const },
    bold: { fontFamily: fonts.bold, fontWeight: 'normal' as const },
    heavy: { fontFamily: fonts.extrabold, fontWeight: 'normal' as const },
  },
};

function RootNavigator() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return <Loading message="Cargando tu cuenta…" />;

  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontFamily: fonts.bold },
          headerBackTitleStyle: { fontFamily: fonts.regular },
          headerStyle: { backgroundColor: colors.surface },
          contentStyle: { backgroundColor: colors.background },
          // Las pantallas de detalle también tienen la campana de notificaciones.
          headerRight: () => <NotificationBell size="sm" />,
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(client)" options={{ headerShown: false }} />
        <Stack.Screen name="(applicant)" options={{ headerShown: false }} />
        <Stack.Screen name="(expert)" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="change-password" options={{ headerShown: false }} />
        <Stack.Screen name="service/[id]/index" options={{ title: 'Detalle del servicio', headerBackTitle: 'Volver' }} />
        <Stack.Screen name="service/[id]/quote" options={{ title: 'Cotización', headerBackTitle: 'Volver' }} />
        <Stack.Screen name="service/[id]/work/[date]" options={{ title: 'Jornada', headerBackTitle: 'Volver' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notificaciones', headerBackTitle: 'Volver', headerRight: () => null }} />
      </Stack>
      <NotificationToast />
      <UpdateWatcher />
    </>
  );
}

export default function RootLayout() {
  // Mulish (400–900). Si falla la carga se sigue con la fuente del sistema.
  const [fontsLoaded, fontError] = useFonts({
    Mulish_400Regular,
    Mulish_400Regular_Italic,
    Mulish_500Medium,
    Mulish_600SemiBold,
    Mulish_700Bold,
    Mulish_800ExtraBold,
    Mulish_900Black,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <AuthProvider>
          <NotificationsProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
