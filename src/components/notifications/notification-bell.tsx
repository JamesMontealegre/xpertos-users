import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors } from '@/constants/theme';
import { useNotifications } from '@/providers/notifications';

/** Campana con el número de avisos sin leer; abre el buzón. `sm` para el encabezado de las pantallas de detalle. */
export function NotificationBell({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const { enabled, unread } = useNotifications();
  if (!enabled) return null;

  const label = unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      style={({ pressed }) => [styles.button, size === 'sm' && styles.small, pressed && styles.pressed]}>
      <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={size === 'sm' ? 20 : 22} color={colors.primary} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  small: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  pressed: { opacity: 0.7 },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '700' },
});
