import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { formatRelative } from '@/lib/format';
import { homeFor } from '@/lib/home';
import { notificationHref } from '@/lib/notifications';
import { useAuth } from '@/providers/auth';
import { useFeedback } from '@/providers/feedback';
import { useNotifications, type AppNotification } from '@/providers/notifications';

/** Buzón: los mensajes del equipo de Xpertos sobre la postulación y los servicios, del más reciente al más antiguo. */
export default function NotificationsScreen() {
  const guard = useRoleGuard(['client', 'expert', 'admin']);
  const { profile, isApplicant } = useAuth();
  const { items, unread, reload, markRead, markAllRead } = useNotifications();
  const { toast } = useFeedback();
  const [refreshing, setRefreshing] = useState(false);

  if (guard) return guard;

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const open = (n: AppNotification) => {
    void markRead(n.id);
    const href = notificationHref(n.link, profile, isApplicant);
    if (href) router.push(href);
  };

  // Abierta directamente (enlace o recarga en la web) no hay a dónde volver: la flecha lleva al inicio.
  const headerLeft =
    !router.canGoBack() && profile
      ? () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir al inicio"
            onPress={() => router.replace(homeFor(profile, isApplicant))}
            hitSlop={8}
            style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
        )
      : undefined;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {headerLeft ? <Stack.Screen options={{ headerLeft }} /> : null}
      <View style={styles.toolbar}>
        <Text style={styles.summary}>
          {unread === 0 ? 'Estás al día' : unread === 1 ? '1 sin leer' : `${unread} sin leer`}
        </Text>
        {unread > 0 ? <Button title="Marcar todas como leídas" variant="ghost" size="sm" onPress={async () => {
              const ok = await markAllRead();
              toast(ok ? 'Marcamos todas como leídas.' : 'No pudimos marcar las notificaciones. Intenta de nuevo.', ok ? 'success' : 'error');
            }}
          /> : null}
      </View>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon="notifications-outline"
            title="No tienes notificaciones"
            description="Aquí verás los mensajes del equipo de Xpertos sobre tu postulación y tus servicios."
          />
        </Card>
      ) : (
        <Card style={styles.list}>
          {items.map((n, i) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              accessibilityLabel={`${n.read_at ? '' : 'Sin leer. '}${n.title}`}
              onPress={() => open(n)}
              style={({ pressed }) => [styles.item, i > 0 && styles.divider, !n.read_at && styles.unreadItem, pressed && styles.pressed]}>
              <View style={[styles.dot, !n.read_at && styles.dotUnread]} />
              <View style={styles.texts}>
                <Text style={[styles.title, !n.read_at && styles.titleUnread]}>{n.title}</Text>
                {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
                <Text style={styles.time}>{formatRelative(n.created_at)}</Text>
              </View>
              {n.link ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, minHeight: 36 },
  summary: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  back: { paddingHorizontal: spacing.sm },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  unreadItem: { backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.75 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: 'transparent' },
  dotUnread: { backgroundColor: colors.accent },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 15, color: colors.text, fontWeight: '600' },
  titleUnread: { fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  time: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
