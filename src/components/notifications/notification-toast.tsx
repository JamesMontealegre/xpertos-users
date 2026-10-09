import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { colors, maxContentWidth, spacing } from '@/constants/theme';
import { notificationHref } from '@/lib/notifications';
import { useAuth } from '@/providers/auth';
import { useNotifications } from '@/providers/notifications';

const VISIBLE_MS = 7000;

/** Aviso emergente cuando llega una notificación nueva mientras se usa la app. */
export function NotificationToast() {
  const { latest, dismissLatest, markRead } = useNotifications();
  const { profile, isApplicant } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  useEffect(() => {
    if (!latest) return;
    const timer = setTimeout(dismissLatest, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [latest, dismissLatest]);

  // En el buzón el aviso ya aparece de primero en la lista.
  if (!latest || pathname === '/notifications') return null;

  const open = () => {
    const href = notificationHref(latest.link, profile, isApplicant);
    void markRead(latest.id);
    dismissLatest();
    if (href) router.push(href);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + spacing.sm }]}>
      <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Pressable style={styles.body} onPress={open} accessibilityRole="button" accessibilityHint="Abre el detalle">
          <View style={styles.icon}>
            <Ionicons name="notifications" size={18} color={colors.primary} />
          </View>
          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={2}>
              {latest.title}
            </Text>
            {latest.body ? (
              <Text style={styles.message} numberOfLines={3}>
                {latest.body}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable onPress={dismissLatest} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar aviso">
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    width: '100%',
    maxWidth: maxContentWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  body: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 15, color: colors.text, fontWeight: '700' },
  message: { fontSize: 14, lineHeight: 19, color: colors.textMuted },
});
