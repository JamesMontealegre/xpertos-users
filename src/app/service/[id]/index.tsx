import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ContractSection } from '@/components/service/contract';
import { PayoutFrequencySection } from '@/components/service/payout-frequency';
import { ServicePhotos } from '@/components/service/photos';
import { LifecycleProgress } from '@/components/service/progress';
import { QuoteOptions } from '@/components/service/quote-options';
import { QuoteSummary } from '@/components/service/quote-summary';
import { ReviewSection } from '@/components/service/review';
import { ScheduleCard } from '@/components/service/schedule';
import { StagesSection } from '@/components/service/stages';
import { Timeline } from '@/components/service/timeline';
import { CloseWorkSection, WorkLogsSection, type WorkLog } from '@/components/service/work-logs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, KeyValue, SectionTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner, InfoBanner, Loading, Screen, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums, Tables } from '@/lib/database.types';
import { formatCOP, formatDateTime, formatPlainDate } from '@/lib/format';
import { pricingModeLabel, serviceStatus, serviceStatusHelp } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import { useFeedback } from '@/providers/feedback';

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
  quote: Tables<'service_quotes'> | null;
  items: Tables<'quote_items'>[];
  materials: Tables<'quote_materials'>[];
  schedule: Tables<'service_schedule'> | null;
  accounts: Tables<'payment_accounts'>[];
  logs: WorkLog[];
  holidays: string[];
};

/** Estados en los que hay obra iniciada (jornadas, cierre). */
const WORK_STATUSES: Enums<'service_status'>[] = ['in_progress', 'paused', 'under_review', 'completed'];
/** Estados con cotización aprobada (el cliente ve el resumen). */
const APPROVED_STATUSES: Enums<'service_status'>[] = ['pending_payment', 'scheduled', ...WORK_STATUSES];

function parseSlots(value: unknown): Slot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Slot => typeof v === 'object' && v !== null && typeof (v as Slot).date === 'string' && typeof (v as Slot).from === 'string'
  );
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { confirm } = useFeedback();
  const { session, profile } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
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
        : Promise.resolve({ data: [] as WorkLog[] }),
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
      load();
    }, [load])
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
        {!error ? <Loading /> : null}
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
  const clientPendingPayment = isClient && service.status === 'pending_payment';
  const proofInReview = detail.payments.some((p) => p.status === 'submitted');
  const proofRejected = !proofInReview && detail.stages.some((st) => st.status === 'rejected');
  const hasWork = WORK_STATUSES.includes(service.status);
  const logsSignature = detail.logs
    .map((l) => `${l.id}:${l.check_in}:${l.check_out}:${l.work_log_photos.length}`)
    .join('|');

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: service.title }} />
      <ErrorBanner seq={errorSeq} message={error} />

      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{service.title}</Text>
          <Badge label={status.label} tone={status.tone} />
        </View>
        <Text style={styles.category}>{service.service_categories?.name ?? 'Sin categoría'}</Text>
        <LifecycleProgress status={service.status} cancelledFrom={cancelledFrom} />
        {!clientPendingPayment ? (
          <InfoBanner
            tone={service.status === 'paused' ? 'warning' : service.status === 'completed' ? 'success' : 'info'}
            message={
              service.status === 'quoting' && quote?.status === 'approved' && quote.total == null
                ? isClient
                  ? 'Tu cotización está lista. Revisa la mano de obra y los materiales, y elige cómo quieres el servicio.'
                  : 'Xpertos aprobó tu cotización y se la presentó al cliente: está eligiendo entre solo mano de obra y todo incluido.'
                : isClient
                  ? serviceStatusHelp[service.status].client
                  : serviceStatusHelp[service.status].expert
            }
          />
        ) : null}
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

      {clientPendingPayment ? (
        <View style={styles.payBanner}>
          <Ionicons name="card-outline" size={26} color="#FFFFFF" />
          <View style={styles.payBannerText}>
            <Text style={styles.payBannerTitle}>Tu servicio fue revisado y está pendiente de pago</Text>
            <Text style={styles.payBannerSubtitle}>
              {proofInReview
                ? 'Recibimos tu comprobante. El estado cambia a Programado cuando Xpertos verifique el pago en el banco.'
                : proofRejected
                  ? 'Tu último comprobante fue rechazado. Revisa la nota en «Pago del servicio» y sube otro.'
                  : 'Paga el total en una de las cuentas de Xpertos y sube el comprobante. El estado cambia a Programado cuando Xpertos verifique el pago en el banco.'}
            </Text>
          </View>
        </View>
      ) : null}

      {isClient && service.status === 'under_review' ? (
        <InfoBanner
          tone="success"
          message={`Xpertos te contactará para verificar el trabajo en máximo 1 día hábil${
            service.review_due_date ? ` (a más tardar el ${formatPlainDate(service.review_due_date)})` : ''
          }.`}
        />
      ) : null}

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

      {isClient && service.status === 'requested' ? (
        <Button
          title="Cancelar solicitud"
          variant="danger"
          loading={updating}
          onPress={async () => {
            const ok = await confirm({
              title: 'Cancelar solicitud',
              message: '¿Seguro que quieres cancelar esta solicitud? No podrás reactivarla.',
              confirmLabel: 'Cancelar solicitud',
              destructive: true,
            });
            if (ok) cancelRequest();
          }}
        />
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

      {isClient && quote && service.status === 'quoting' && quote.status === 'approved' && quote.total == null ? (
        <>
          <SectionTitle>Tu cotización está lista</SectionTitle>
          <Card style={styles.card}>
            <QuoteOptions serviceId={service.id} quote={quote} items={detail.items} materials={detail.materials} onChosen={load} />
          </Card>
        </>
      ) : null}

      {isClient && quote && APPROVED_STATUSES.includes(service.status) ? (
        <>
          <SectionTitle>Cotización aprobada</SectionTitle>
          <Card style={styles.card}>
            <QuoteSummary quote={quote} items={detail.items} materials={detail.materials} audience="client" />
          </Card>
        </>
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

      {detail.contract ? (
        <ContractSection contract={detail.contract} signatures={detail.signatures} service={service} userId={userId} onChanged={load} />
      ) : null}

      {service.status === 'completed' ? (
        <ReviewSection service={service} reviews={detail.reviews} userId={userId} counterpartName={counterpartName} onChanged={load} />
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
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  slots: { gap: spacing.xs, marginTop: spacing.xs },
  slotsLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slotText: { fontSize: 14, color: colors.text },
  payBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius,
    padding: spacing.md,
  },
  payBannerText: { flex: 1, gap: 4 },
  payBannerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', lineHeight: 23 },
  payBannerSubtitle: { fontSize: 14, color: '#FFF7ED', lineHeight: 20 },
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
