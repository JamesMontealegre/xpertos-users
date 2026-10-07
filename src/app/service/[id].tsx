import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ContractSection } from '@/components/service/contract';
import { ServicePhotos } from '@/components/service/photos';
import { ReviewSection } from '@/components/service/review';
import { StagesSection } from '@/components/service/stages';
import { Timeline } from '@/components/service/timeline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, KeyValue, SectionTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner, InfoBanner, Loading, Screen } from '@/components/ui/screen';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums, Tables } from '@/lib/database.types';
import { formatCOP, formatDateTime, formatPlainDate } from '@/lib/format';
import { serviceStatus, serviceStatusHelp } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

type Slot = { date: string; from: string; to: string };

type Detail = {
  service: Tables<'services'> & { service_categories: { name: string } | null };
  photos: Tables<'service_photos'>[];
  stages: Tables<'service_stages'>[];
  payments: Tables<'payments'>[];
  contract: Tables<'contracts'> | null;
  signatures: Tables<'contract_signatures'>[];
  reviews: Tables<'service_reviews'>[];
  events: Tables<'service_events'>[];
  counterpart: Tables<'profiles'> | null;
};

function parseSlots(value: unknown): Slot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Slot => typeof v === 'object' && v !== null && typeof (v as Slot).date === 'string' && typeof (v as Slot).from === 'string'
  );
}

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Volver', style: 'cancel' },
    { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!session || !id) return;
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*, service_categories(name)')
      .eq('id', id)
      .maybeSingle();
    if (serviceError) {
      setError(`No pudimos cargar el servicio: ${serviceError.message}`);
      return;
    }
    if (!service) {
      setNotFound(true);
      return;
    }
    const counterpartId = service.client_id === session.user.id ? service.expert_id : service.client_id;
    const [photos, stages, payments, contract, reviews, events, counterpart] = await Promise.all([
      supabase.from('service_photos').select('*').eq('service_id', id).order('created_at'),
      supabase.from('service_stages').select('*').eq('service_id', id).order('position'),
      supabase.from('payments').select('*').eq('service_id', id).order('created_at', { ascending: false }),
      supabase.from('contracts').select('*').eq('service_id', id).maybeSingle(),
      supabase.from('service_reviews').select('*').eq('service_id', id),
      supabase.from('service_events').select('*').eq('service_id', id).order('created_at'),
      counterpartId ? supabase.from('profiles').select('*').eq('id', counterpartId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const signatures = contract.data
      ? await supabase.from('contract_signatures').select('*').eq('contract_id', contract.data.id)
      : { data: [] };

    setError(null);
    setDetail({
      service,
      photos: photos.data ?? [],
      stages: stages.data ?? [],
      payments: payments.data ?? [],
      contract: contract.data ?? null,
      signatures: signatures.data ?? [],
      reviews: reviews.data ?? [],
      events: events.data ?? [],
      counterpart: counterpart.data ?? null,
    });
  }, [session, id]);

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

  const changeStatus = async (status: Enums<'service_status'>) => {
    if (!detail) return;
    setUpdating(true);
    setError(null);
    const { error: updateError } = await supabase.from('services').update({ status }).eq('id', detail.service.id);
    setUpdating(false);
    if (updateError) {
      setError(`No se pudo actualizar el estado: ${updateError.message}`);
      return;
    }
    await load();
  };

  if (notFound) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Servicio no encontrado" description="Puede que no tengas acceso o que haya sido eliminado." />
      </Screen>
    );
  }
  if (!detail || !session || !profile) {
    return (
      <Screen>
        <ErrorBanner message={error} />
        {!error ? <Loading /> : null}
      </Screen>
    );
  }

  const { service, counterpart } = detail;
  const isClient = service.client_id === session.user.id;
  const isExpert = service.expert_id === session.user.id;
  const status = serviceStatus[service.status];
  const slots = parseSlots(service.availability);
  const counterpartName = counterpart?.full_name || (isClient ? 'tu experto' : 'el cliente');

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: service.title }} />
      <ErrorBanner message={error} />

      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{service.title}</Text>
          <Badge label={status.label} tone={status.tone} />
        </View>
        <Text style={styles.category}>{service.service_categories?.name ?? 'Sin categoría'}</Text>
        <InfoBanner message={isClient ? serviceStatusHelp[service.status].client : serviceStatusHelp[service.status].expert} />
        <KeyValue label="Descripción" value={service.description} />
        <KeyValue label="Dirección" value={[service.address, service.city].filter(Boolean).join(', ')} />
        {service.estimated_price != null ? <KeyValue label="Valor estimado" value={formatCOP(service.estimated_price)} /> : null}
        {service.scheduled_at ? <KeyValue label="Programado para" value={formatDateTime(service.scheduled_at)} /> : null}
        <KeyValue label="Solicitado" value={formatDateTime(service.created_at)} />
        {slots.length > 0 ? (
          <View style={styles.slots}>
            <Text style={styles.slotsLabel}>Disponibilidad del cliente</Text>
            {slots.map((slot, idx) => (
              <View key={`${slot.date}-${idx}`} style={styles.slot}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.slotText}>
                  {formatPlainDate(slot.date)} · {slot.from} – {slot.to}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {counterpart ? (
        <>
          <SectionTitle>{isClient ? 'Experto asignado' : 'Cliente'}</SectionTitle>
          <Card style={styles.personCard}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={22} color={colors.primary} />
            </View>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>{counterpart.full_name}</Text>
              {counterpart.city ? <Text style={styles.personMeta}>{counterpart.city}</Text> : null}
            </View>
            {counterpart.phone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Llamar a ${counterpart.full_name}`}
                onPress={() => Linking.openURL(`tel:${counterpart.phone}`)}
                style={styles.phone}>
                <Ionicons name="call-outline" size={16} color={colors.primary} />
                <Text style={styles.phoneText}>{counterpart.phone}</Text>
              </Pressable>
            ) : null}
          </Card>
        </>
      ) : isClient && (service.status === 'requested' || service.status === 'in_review') ? null : null}

      {isExpert && service.status === 'assigned' ? (
        <Button title="Iniciar servicio" onPress={() => changeStatus('in_progress')} loading={updating} />
      ) : null}
      {isExpert && service.status === 'in_progress' ? (
        <Button title="Marcar como completado" variant="secondary" onPress={() => changeStatus('completed')} loading={updating} />
      ) : null}
      {isClient && service.status === 'requested' ? (
        <Button
          title="Cancelar solicitud"
          variant="danger"
          loading={updating}
          onPress={() =>
            confirm('Cancelar solicitud', '¿Seguro que quieres cancelar esta solicitud? No podrás reactivarla.', () =>
              changeStatus('cancelled')
            )
          }
        />
      ) : null}

      <ServicePhotos photos={detail.photos} />

      <StagesSection
        service={service}
        stages={detail.stages}
        payments={detail.payments}
        isClient={isClient}
        userId={session.user.id}
        onChanged={load}
      />

      {detail.contract ? (
        <ContractSection contract={detail.contract} signatures={detail.signatures} service={service} userId={session.user.id} onChanged={load} />
      ) : null}

      {service.status === 'completed' ? (
        <ReviewSection service={service} reviews={detail.reviews} userId={session.user.id} counterpartName={counterpartName} onChanged={load} />
      ) : null}

      <Timeline events={detail.events} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text },
  category: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  slots: { gap: spacing.xs, marginTop: spacing.xs },
  slotsLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slotText: { fontSize: 14, color: colors.text },
  personCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInfo: { flex: 1 },
  personName: { fontSize: 16, fontWeight: '700', color: colors.text },
  personMeta: { fontSize: 13, color: colors.textMuted },
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius,
    backgroundColor: colors.primarySoft,
  },
  phoneText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
