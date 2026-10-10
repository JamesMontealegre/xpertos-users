import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ClientServiceView } from '@/components/service/client-view';
import { PayoutFrequencySection } from '@/components/service/payout-frequency';
import { ServicePhotos } from '@/components/service/photos';
import { LifecycleProgress } from '@/components/service/progress';
import { QuoteSummary } from '@/components/service/quote-summary';
import { ReviewSection } from '@/components/service/review';
import { ScheduleCard } from '@/components/service/schedule';
import { StagesSection } from '@/components/service/stages';
import { Timeline } from '@/components/service/timeline';
import { CloseWorkSection, WorkLogsSection } from '@/components/service/work-logs';
import { Badge } from '@/components/ui/badge';
import { BackFallback } from '@/components/back-fallback';
import { Button } from '@/components/ui/button';
import { Card, KeyValue, SectionTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner, InfoBanner, Loading, Screen, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatCOP, formatDateTime, formatPlainDate } from '@/lib/format';
import { pricingModeLabel, serviceStatus, serviceStatusHelp } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { homeFor } from '@/lib/home';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { useAuth } from '@/providers/auth';
import { useFeedback } from '@/providers/feedback';
import { APPROVED_STATUSES, parseSlots, WORK_STATUSES, type ServiceDetail } from '@/lib/service-detail';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { confirm } = useFeedback();
  const { session, profile, isApplicant } = useAuth();
  // Sin sesión (p. ej. se cerró en otra pestaña) lleva al ingreso en vez de quedarse cargando.
  const guard = useRoleGuard(['client', 'expert', 'admin']);
  const [detail, setDetail] = useState<ServiceDetail | null>(null);
  const [error, setError, errorSeq] = useErrorState();
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
    const isClient = service.client_id === session.user.id;
    const counterpartId = isClient ? service.expert_id : service.client_id;
    const hasWork = WORK_STATUSES.includes(service.status);
    const [photos, stages, payments, contract, reviews, events, counterpart, quote, schedule, accounts, logs] = await Promise.all([
      supabase.from('service_photos').select('*').eq('service_id', id).order('created_at'),
      supabase.from('service_stages').select('*').eq('service_id', id).order('position'),
      supabase.from('payments').select('*').eq('service_id', id).order('created_at', { ascending: false }),
      supabase.from('contracts').select('*').eq('service_id', id).maybeSingle(),
      supabase.from('service_reviews').select('*').eq('service_id', id),
      supabase.from('service_events').select('*').eq('service_id', id).order('created_at'),
      counterpartId ? supabase.from('profiles').select('*').eq('id', counterpartId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('service_quotes').select('*, quote_items(*), quote_materials(*)').eq('service_id', id).maybeSingle(),
      supabase.from('service_schedule').select('*').eq('service_id', id).maybeSingle(),
      isClient
        ? supabase.from('payment_accounts').select('*').eq('active', true).order('sort_order')
        : Promise.resolve({ data: [] as Tables<'payment_accounts'>[] }),
      hasWork
        ? supabase.from('work_logs').select('*, work_log_photos(*)').eq('service_id', id).order('work_date')
        : Promise.resolve({ data: [] as ServiceDetail['logs'] }),
    ]);
    const [signatures, holidays] = await Promise.all([
      contract.data
        ? supabase.from('contract_signatures').select('*').eq('contract_id', contract.data.id)
        : Promise.resolve({ data: [] as Tables<'contract_signatures'>[] }),
      service.status === 'in_progress' && service.start_date
        ? supabase.from('holidays').select('day').gte('day', service.start_date)
        : Promise.resolve({ data: [] as { day: string }[] }),
    ]);

    const { quote_items: items, quote_materials: materials, ...quoteRow } = quote.data ?? { quote_items: [], quote_materials: [] };
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
      quote: quote.data ? (quoteRow as Tables<'service_quotes'>) : null,
      items: [...items].sort((a, b) => a.position - b.position),
      materials: [...materials].sort((a, b) => a.position - b.position),
      schedule: schedule.data ?? null,
      accounts: accounts.data ?? [],
      logs: logs.data ?? [],
      holidays: (holidays.data ?? []).map((h) => h.day),
    });
  }, [session, id, setError]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setError('No pudimos cargar la información. Revisa tu conexión e intenta de nuevo.'));
    }, [load, setError])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const cancelRequest = async () => {
    if (!detail) return;
    setUpdating(true);
    setError(null);
    const { error: updateError } = await supabase.from('services').update({ status: 'cancelled' }).eq('id', detail.service.id);
    setUpdating(false);
    if (updateError) {
      setError(`No se pudo cancelar la solicitud: ${updateError.message}`);
      return;
    }
    await load();
  };

  const confirmCancel = async () => {
    const ok = await confirm({
      title: 'Cancelar solicitud',
      message: '¿Seguro que quieres cancelar esta solicitud? No podrás reactivarla.',
      confirmLabel: 'Cancelar solicitud',
      destructive: true,
    });
    if (ok) cancelRequest();
  };

  if (guard) return guard;
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
        <ErrorBanner seq={errorSeq} message={error} />
        {error ? <Button title="Reintentar" variant="outline" onPress={() => void load()} /> : <Loading />}
      </Screen>
    );
  }

  const { service, counterpart, quote } = detail;
  const userId = session.user.id;
  const isClient = service.client_id === userId;
  const isExpert = service.expert_id === userId;
  const status = serviceStatus[service.status];
  const slots = parseSlots(service.availability);
  const counterpartName = counterpart?.full_name || (isClient ? 'tu experto' : 'el cliente');
  const cancelledFrom = [...detail.events].reverse().find((e) => e.type === 'status_change' && e.to_status === 'cancelled')?.from_status;
  const hasWork = WORK_STATUSES.includes(service.status);
  const logsSignature = detail.logs
    .map((l) => `${l.id}:${l.check_in}:${l.check_out}:${l.work_log_photos.length}`)
    .join('|');

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: service.title }} />
      {profile ? <BackFallback href={homeFor(profile, isApplicant)} label="Ir al inicio" /> : null}
      <ErrorBanner seq={errorSeq} message={error} />

      {isClient ? (
        <ClientServiceView detail={detail} userId={userId} onChanged={load} onCancelRequest={confirmCancel} cancelling={updating} />
      ) : (
        <>
          <Card style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{service.title}</Text>
              <Badge label={status.label} tone={status.tone} />
            </View>
            <Text style={styles.category}>{service.service_categories?.name ?? 'Sin categoría'}</Text>
            <LifecycleProgress status={service.status} cancelledFrom={cancelledFrom} />
            <InfoBanner
              tone={service.status === 'paused' ? 'warning' : service.status === 'completed' ? 'success' : 'info'}
              message={
                service.status === 'quoting' && quote?.status === 'approved' && quote.total == null
                  ? 'Xpertos aprobó tu cotización y se la presentó al cliente: está eligiendo entre solo mano de obra y todo incluido.'
                  : serviceStatusHelp[service.status].expert
              }
            />
            {service.status === 'paused' && service.pause_reason ? <KeyValue label="Motivo de la pausa" value={service.pause_reason} /> : null}
            {service.status === 'cancelled' && service.cancel_reason ? (
              <KeyValue label="Motivo de la cancelación" value={service.cancel_reason} />
            ) : null}
            <KeyValue label="Descripción" value={service.description} />
            <KeyValue label="Dirección" value={[service.address, service.city].filter(Boolean).join(', ')} />
            <KeyValue label="Modalidad" value={service.pricing_mode ? pricingModeLabel(service.pricing_mode) : 'Se elige al presentar la cotización'} />
            {/* El valor existe cuando el cliente ya eligió la opción de la cotización. */}
            {service.estimated_price != null && APPROVED_STATUSES.includes(service.status) ? (
              <KeyValue label="Valor del servicio" value={formatCOP(service.estimated_price)} />
            ) : null}
            {service.scheduled_at && ['assigned', 'quoting'].includes(service.status) ? (
              <KeyValue label="Visita acordada" value={formatDateTime(service.scheduled_at)} />
            ) : null}
            <KeyValue label="Solicitado" value={formatDateTime(service.created_at)} />
            {slots.length > 0 && ['requested', 'assigned', 'quoting'].includes(service.status) ? (
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

          <ScheduleCard service={service} schedule={detail.schedule} />

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
          ) : null}

          {isExpert && service.status === 'assigned' ? (
            <>
              <SectionTitle>Cotización</SectionTitle>
              <Card style={styles.card}>
                {quote?.status === 'returned' ? (
                  <InfoBanner tone="warning" message={`Xpertos devolvió tu cotización${quote.admin_notes ? `: ${quote.admin_notes}` : '.'}`} />
                ) : null}
                <Text style={styles.help}>
                  Arma la cotización con las actividades, los materiales y fotos del antes. Xpertos la revisa antes de enviarla al cliente.
                  Recuerda: Xpertos descuenta el {Number(service.commission_pct)} % de tu cotización por el uso de la plataforma.
                </Text>
                <Button
                  title={!quote ? 'Armar cotización' : quote.status === 'returned' ? 'Corregir cotización' : 'Continuar cotización'}
                  onPress={() => router.push({ pathname: '/service/[id]/quote', params: { id: service.id } })}
                />
              </Card>
            </>
          ) : null}

          {isExpert && quote && service.status !== 'assigned' && service.status !== 'cancelled' ? (
            <>
              <SectionTitle>Tu cotización</SectionTitle>
              <Card style={styles.card}>
                <QuoteSummary
                  quote={quote}
                  items={detail.items}
                  materials={detail.materials}
                  audience="expert"
                  commissionPct={Number(service.commission_pct)}
                  showStatus
                />
              </Card>
            </>
          ) : null}

          {isExpert && (APPROVED_STATUSES.includes(service.status)) ? (
            <PayoutFrequencySection service={service} userId={userId} onChanged={load} />
          ) : null}

          {/* El cobro existe desde que el cliente elige la opción de la cotización (Pendiente de pago). */}
          {APPROVED_STATUSES.includes(service.status) ? (
            <StagesSection
              service={service}
              stages={detail.stages}
              payments={detail.payments}
              accounts={detail.accounts}
              isClient={isClient}
              userId={userId}
              onChanged={load}
            />
          ) : null}

          {hasWork && (isClient || isExpert) ? (
            <WorkLogsSection
              service={service}
              schedule={detail.schedule}
              logs={detail.logs}
              holidays={detail.holidays}
              editable={isExpert && service.status === 'in_progress'}
            />
          ) : null}

          {isExpert && service.status === 'in_progress' ? (
            // Se reinicia cuando cambian las jornadas para no mostrar faltantes desactualizados.
            <CloseWorkSection key={logsSignature} service={service} onChanged={load} />
          ) : null}

          {service.closing_notes && ['under_review', 'completed'].includes(service.status) ? (
            <Card style={styles.card}>
              <KeyValue label="Notas de cierre del experto" value={service.closing_notes} />
            </Card>
          ) : null}

          <ServicePhotos photos={detail.photos} />

          {service.status === 'completed' ? (
            <ReviewSection service={service} reviews={detail.reviews} userId={userId} counterpartName={counterpartName} onChanged={load} />
          ) : null}

          <Timeline events={detail.events} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text },
  category: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
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
