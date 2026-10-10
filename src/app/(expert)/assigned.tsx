import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ServiceCard, type ServiceListItem } from '@/components/service-card';
import { SectionTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner, Loading, Screen, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

const groups: { key: string; title: string; hint: string; statuses: ServiceListItem['status'][] }[] = [
  { key: 'to-quote', title: 'Por cotizar', hint: 'Arma y envía la cotización.', statuses: ['assigned'] },
  { key: 'quoting', title: 'En cotización', hint: 'Xpertos está revisando tu cotización.', statuses: ['quoting'] },
  {
    key: 'scheduled',
    title: 'Pendiente de pago / Programado',
    hint: 'Elige la periodicidad de tu pago y prepárate para el inicio.',
    statuses: ['pending_payment', 'scheduled'],
  },
  { key: 'doing', title: 'En ejecución o en pausa', hint: 'Registra tus jornadas y cierra el trabajo.', statuses: ['in_progress', 'paused'] },
  { key: 'review', title: 'En observación', hint: 'Xpertos verifica con el cliente.', statuses: ['under_review'] },
  { key: 'done', title: 'Finalizados', hint: '', statuses: ['completed'] },
];

export default function AssignedServicesScreen() {
  const { session } = useAuth();
  const [services, setServices] = useState<ServiceListItem[] | null>(null);
  const [error, setError, errorSeq] = useErrorState();
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
  }, [session, setError]);

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
    <Screen title="Servicios asignados" subtitle="Tus servicios según la etapa en que están" refreshing={refreshing} onRefresh={refresh} withTabs>
      <ErrorBanner seq={errorSeq} message={error} />
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
                {items.length > 0 && group.hint ? <Text style={styles.hint}>{group.hint}</Text> : null}
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
  hint: { color: colors.textMuted, fontSize: 13, marginTop: -4 },
});
