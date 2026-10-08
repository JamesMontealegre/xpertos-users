import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ServiceCard, type ServiceListItem } from '@/components/service-card';
import { SectionTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner, Loading, Screen } from '@/components/ui/screen';
import { colors, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

const groups: { key: string; title: string; statuses: ServiceListItem['status'][] }[] = [
  { key: 'todo', title: 'Por iniciar', statuses: ['assigned'] },
  { key: 'doing', title: 'En ejecución o en pausa', statuses: ['in_progress', 'paused'] },
  { key: 'done', title: 'Completados', statuses: ['completed'] },
];

export default function AssignedServicesScreen() {
  const { session } = useAuth();
  const [services, setServices] = useState<ServiceListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error: queryError } = await supabase
      .from('services')
      .select('*, service_categories(name)')
      .eq('expert_id', session.user.id)
      .order('created_at', { ascending: false });
    if (queryError) setError(`No pudimos cargar tus servicios: ${queryError.message}`);
    else {
      setError(null);
      setServices(data);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const others = services?.filter((s) => s.status === 'cancelled') ?? [];

  return (
    <Screen title="Servicios asignados" subtitle="Tu trabajo pendiente y completado" refreshing={refreshing} onRefresh={refresh} withTabs>
      <ErrorBanner message={error} />
      {services === null && !error ? (
        <Loading />
      ) : services && services.length === 0 ? (
        <EmptyState
          icon="briefcase-outline"
          title="Aún no tienes servicios asignados"
          description="Cuando el operador te asigne un servicio aparecerá aquí. Mantén tu disponibilidad actualizada."
        />
      ) : (
        <>
          {groups.map((group) => {
            const items = services?.filter((s) => group.statuses.includes(s.status)) ?? [];
            return (
              <View key={group.key} style={styles.group}>
                <SectionTitle right={<Text style={styles.count}>{items.length}</Text>}>{group.title}</SectionTitle>
                {items.length === 0 ? (
                  <Text style={styles.empty}>Nada por aquí.</Text>
                ) : (
                  items.map((service) => <ServiceCard key={service.id} service={service} />)
                )}
              </View>
            );
          })}
          {others.length > 0 ? (
            <View style={styles.group}>
              <SectionTitle>Cancelados</SectionTitle>
              {others.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  count: { color: colors.textMuted, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic' },
});
