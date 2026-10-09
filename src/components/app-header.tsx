import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { colors, maxContentWidth, spacing } from '@/constants/theme';
import { homeFor } from '@/lib/home';
import { useAuth } from '@/providers/auth';

/** Alto del encabezado sin el área segura superior. */
export const APP_HEADER_HEIGHT = 60;

/**
 * Encabezado fijo de las pantallas con pestañas: logo de Xpertos (lleva al inicio) y campana de
 * notificaciones. No se desplaza con el contenido; el título de cada sección va debajo, en la pantalla.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { profile, isApplicant } = useAuth();

  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: APP_HEADER_HEIGHT + insets.top }]}>
      <View style={styles.inner}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Xpertos, ir al inicio"
          onPress={() => profile && router.navigate(homeFor(profile, isApplicant))}
          hitSlop={6}>
          <Logo variant="wordmark" width={128} />
        </Pressable>
        <NotificationBell />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
