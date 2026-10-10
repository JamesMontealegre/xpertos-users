import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { PayoutFrequencySection } from '@/components/service/payout-frequency';
import { ServicePhotos } from '@/components/service/photos';
import { LifecycleProgress } from '@/components/service/progress';
import { QuoteSummary } from '@/components/service/quote-summary';
import { ReviewSection } from '@/components/service/review';
import { ScheduleCard } from '@/components/service/schedule';
import { daysLabel, Facts, NextSteps, SectionList, Step, useSections, type SectionSpec } from '@/components/service/sections';
import { Timeline } from '@/components/service/timeline';
import { CloseWorkSection, WorkLogsSection } from '@/components/service/work-logs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KeyValue } from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import { InfoBanner } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums } from '@/lib/database.types';
import { formatCOP, formatDate, formatDateTime, formatPlainDate, todayCO } from '@/lib/format';
import { payoutFrequencyLabel, pricingModeLabel, quoteStatus, serviceStatus, serviceStatusHelp } from '@/lib/labels';
import { APPROVED_STATUSES, parseSlots, WORK_STATUSES, type ServiceDetail } from '@/lib/service-detail';

type SectionKey = 'quote' | 'payout' | 'work' | 'close' | 'review' | 'client' | 'request' | 'history';

/**
 * Orden de las secciones según lo que más le sirve al experto en cada estado: primero lo que tiene que hacer
 * (cotizar, elegir cómo recibe el pago, registrar jornadas, cerrar, calificar), luego el detalle y el historial.
 */
const ORDER: Partial<Record<Enums<'service_status'>, SectionKey[]>> = {
  assigned: ['quote', 'client', 'request', 'history'],
  quoting: ['quote', 'client', 'request', 'history'],
  pending_payment: ['payout', 'quote', 'client', 'request', 'history'],
  scheduled: ['payout', 'quote', 'client', 'request', 'history'],
  in_progress: ['work', 'close', 'quote', 'client', 'request', 'payout', 'history'],
  paused: ['work', 'quote', 'client', 'request', 'payout', 'history'],
  under_review: ['work', 'quote', 'client', 'request', 'payout', 'history'],
  completed: ['review', 'work', 'quote', 'payout', 'client', 'request', 'history'],
};
const DEFAULT_ORDER: SectionKey[] = ['quote', 'client', 'request', 'history'];

type Props = {
  detail: ServiceDetail;
  userId: string;
  onChanged: () => Promise<void>;
};

/**
 * Detalle del servicio para el experto: un resumen desplegado (estado, qué sigue y datos clave: su cotización,
 * la comisión y lo que recibe) y el resto en secciones plegables, cerradas por defecto. No ve el valor que paga
 * el cliente: solo si el pago está verificado.
 */
export function ExpertServiceView({ detail, userId, onChanged }: Props) {
  const { service, quote, counterpart, schedule } = detail;
  const [summaryOpen, setSummaryOpen] = useState(true);
  const sectionState = useSections<SectionKey>();
  const { reveal } = sectionState;

  const isExpert = service.expert_id === userId;
  const status = serviceStatus[service.status];
  const approved = APPROVED_STATUSES.includes(service.status);
  const hasWork = WORK_STATUSES.includes(service.status);
  const cancelledFrom = [...detail.events].reverse().find((e) => e.type === 'status_change' && e.to_status === 'cancelled')?.from_status;
  const slots = parseSlots(service.availability);
  const clientName = counterpart?.full_name || 'el cliente';
  const commissionPct = Number(service.commission_pct);
  const offset = schedule?.start_offset_days ?? 2;
  const today = todayCO();

  // Su cotización: lo aprobado por Xpertos o lo que cotizó; recibe eso menos la comisión.
  const labor = quote ? Number(quote.approved_labor_total ?? quote.labor_total ?? 0) : 0;
  const net = Math.round(labor * (1 - commissionPct / 100));
  const quoteLabel = quote ? quoteStatus[quote.status] : null;
  const choosing = service.status === 'quoting' && quote?.status === 'approved' && quote.total == null;

  // Pago del cliente (sin el valor) y la periodicidad del pago del experto.
  const proofInReview = detail.payments.some((p) => p.status === 'submitted');
  const paid = detail.stages.length > 0 && detail.stages.every((s) => s.status === 'paid');
  const proofRejected = !paid && !proofInReview && detail.stages.some((s) => s.status === 'rejected');
  const clientPayment = paid ? 'Verificado' : proofInReview ? 'En verificación' : proofRejected ? 'Comprobante rechazado' : 'Pendiente';
  const payoutEditable = isExpert && (service.status === 'pending_payment' || service.status === 'scheduled');
  const payoutChosen = detail.events.some((e) => e.type === 'payout_frequency_set');

  const todayLog = detail.logs.find((l) => l.work_date === today);
  const canLogToday = service.status === 'in_progress' && Boolean(schedule?.start_date) && today >= (schedule?.start_date ?? today);
  const logsSignature = detail.logs.map((l) => `${l.id}:${l.check_in}:${l.check_out}:${l.work_log_photos.length}`).join('|');
  const reviewed = detail.reviews.some((r) => r.author_id === userId);

  const openQuote = () => router.push({ pathname: '/service/[id]/quote', params: { id: service.id } });
  const quoteAction = !quote ? 'Armar cotización' : quote.status === 'returned' ? 'Corregir cotización' : 'Continuar cotización';

  const available: Record<SectionKey, boolean> = {
    quote: service.status !== 'requested' && service.status !== 'cancelled' ? true : Boolean(quote),
    payout: approved,
    work: hasWork,
    close: isExpert && service.status === 'in_progress',
    review: service.status === 'completed',
    client: Boolean(counterpart),
    request: true,
    history: true,
  };
  const order = (ORDER[service.status] ?? DEFAULT_ORDER).filter((key) => available[key]);

  const facts: [string, string | null][] = [
    ['Tu cotización', quote && labor > 0 ? formatCOP(labor) : null],
    ['Recibirás al finalizar', quote && labor > 0 ? formatCOP(net) : null],
    ['Comisión Xpertos', `${commissionPct.toLocaleString('es-CO')} % de tu cotización`],
    ['Modalidad', service.pricing_mode ? pricingModeLabel(service.pricing_mode) : null],
    ['Cliente', counterpart?.full_name ?? null],
    ['Visita acordada', service.scheduled_at && ['assigned', 'quoting'].includes(service.status) ? formatDateTime(service.scheduled_at) : null],
    [
      'Inicio de obra',
      service.status === 'pending_payment'
        ? `${offset} días hábiles después del pago del cliente`
        : hasWork && schedule?.start_date
          ? formatPlainDate(schedule.start_date)
          : null,
    ],
    ['Duración estimada', service.status !== 'scheduled' && approved ? daysLabel(schedule?.estimated_days) : null],
    ['Terminación estimada', hasWork && schedule?.estimated_end_date ? formatPlainDate(schedule.estimated_end_date) : null],
    ['Pago del cliente', approved ? clientPayment : null],
    ['Periodicidad de tu pago', approved ? payoutFrequencyLabel(service.payout_frequency) : null],
    ['Trabajo cerrado', service.closed_at && hasWork ? formatDateTime(service.closed_at) : null],
    [
      'Verificación hasta',
      service.status === 'under_review' && service.review_due_date ? formatPlainDate(service.review_due_date) : null,
    ],
  ];

  const sections: Record<SectionKey, SectionSpec> = {
    quote: {
      title: 'Tu cotización',
      subtitle: quote ? [quoteLabel?.label, labor > 0 ? formatCOP(labor) : null].filter(Boolean).join(' · ') : 'Por armar',
      icon: 'pricetags-outline',
      right: quoteLabel ? <Badge label={quoteLabel.label} tone={quoteLabel.tone} /> : <Badge label="Por armar" tone="amber" />,
      body:
        service.status === 'assigned' ? (
          <>
            {quote?.status === 'returned' ? (
              <InfoBanner tone="warning" message={`Xpertos devolvió tu cotización${quote.admin_notes ? `: ${quote.admin_notes}` : '.'}`} />
            ) : null}
            <Text style={styles.help}>
              Arma la cotización con las actividades, los materiales y fotos del antes. Xpertos la revisa antes de enviarla al
              cliente. Recuerda: Xpertos descuenta el {commissionPct.toLocaleString('es-CO')} % de tu cotización por el uso de la
              plataforma.
            </Text>
            <Button title={quoteAction} onPress={openQuote} />
          </>
        ) : quote ? (
          <QuoteSummary
            quote={quote}
            items={detail.items}
            materials={detail.materials}
            audience="expert"
            commissionPct={commissionPct}
            showStatus
          />
        ) : (
          <Text style={styles.help}>Este servicio no tiene cotización.</Text>
        ),
    },
    payout: {
      title: 'Periodicidad de tu pago',
      subtitle: payoutFrequencyLabel(service.payout_frequency),
      icon: 'wallet-outline',
      right: payoutEditable && !payoutChosen ? <Badge label="Por elegir" tone="amber" /> : null,
      body: <PayoutFrequencySection service={service} userId={userId} onChanged={onChanged} embedded />,
    },
    work: {
      title: isExpert && service.status === 'in_progress' ? 'Registro de jornadas' : 'Jornadas registradas',
      subtitle: `${detail.logs.length} ${detail.logs.length === 1 ? 'jornada registrada' : 'jornadas registradas'}`,
      icon: 'construct-outline',
      body: (
        <>
          {service.closing_notes && ['under_review', 'completed'].includes(service.status) ? (
            <KeyValue label="Tus notas de cierre" value={service.closing_notes} />
          ) : null}
          <WorkLogsSection
            service={service}
            schedule={schedule}
            logs={detail.logs}
            holidays={detail.holidays}
            editable={isExpert && service.status === 'in_progress'}
            embedded
          />
        </>
      ),
    },
    close: {
      title: 'Cerrar trabajo',
      subtitle: 'Cuando termines la obra',
      icon: 'flag-outline',
      // Se reinicia cuando cambian las jornadas para no mostrar faltantes desactualizados.
      body: <CloseWorkSection key={logsSignature} service={service} onChanged={onChanged} embedded />,
    },
    review: {
      title: 'Calificación',
      subtitle: reviewed ? 'Ya calificaste al cliente' : `Califica a ${clientName}`,
      icon: 'star-outline',
      right: reviewed ? null : <Badge label="Pendiente" tone="amber" />,
      body: (
        <ReviewSection service={service} reviews={detail.reviews} userId={userId} counterpartName={clientName} onChanged={onChanged} embedded />
      ),
    },
    client: {
      title: 'Cliente',
      subtitle: counterpart?.full_name ?? null,
      icon: 'person-outline',
      body: counterpart ? (
        <>
          <View style={styles.person}>
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
          </View>
          {service.scheduled_at && ['assigned', 'quoting'].includes(service.status) ? (
            <KeyValue label="Visita acordada" value={formatDateTime(service.scheduled_at)} />
          ) : null}
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
        </>
      ) : null,
    },
    request: {
      title: 'Solicitud del cliente',
      subtitle: `Solicitada el ${formatDate(service.created_at)}`,
      icon: 'clipboard-outline',
      body: (
        <>
          <KeyValue label="Descripción" value={service.description} />
          <KeyValue label="Dirección" value={[service.address, service.city].filter(Boolean).join(', ')} />
          <KeyValue label="Solicitado" value={formatDateTime(service.created_at)} />
          <ServicePhotos photos={detail.photos} embedded />
        </>
      ),
    },
    history: {
      title: 'Historial',
      subtitle: `${detail.events.length} ${detail.events.length === 1 ? 'movimiento' : 'movimientos'}`,
      icon: 'time-outline',
      body: <Timeline events={detail.events} embedded />,
    },
  };

  // "Qué sigue" según el estado; si no hay pasos, el texto de ayuda del estado.
  const payoutStep =
    payoutEditable ? (
      <Step
        state={payoutChosen ? 'done' : 'todo'}
        title="Elige cómo quieres recibir tu pago"
        detail={payoutChosen ? `Elegiste: ${payoutFrequencyLabel(service.payout_frequency).toLowerCase()}.` : 'Diario, semanal, quincenal, mensual u obra terminada.'}
        action={payoutChosen ? null : { label: 'Elegir periodicidad', onPress: () => reveal('payout') }}
      />
    ) : null;
  let steps: React.ReactNode = null;
  if (isExpert && service.status === 'assigned') {
    steps = (
      <NextSteps>
        <Step
          state="todo"
          title={`Coordina la visita con ${clientName}`}
          detail={service.scheduled_at ? `Visita acordada: ${formatDateTime(service.scheduled_at)}.` : 'Llama al cliente para conocer el trabajo.'}
          action={counterpart ? { label: 'Ver datos del cliente', onPress: () => reveal('client') } : null}
        />
        <Step
          state={quote?.status === 'returned' ? 'alert' : 'todo'}
          title={quote?.status === 'returned' ? 'Corrige tu cotización' : 'Arma tu cotización'}
          detail={
            quote?.status === 'returned'
              ? `Xpertos te la devolvió${quote.admin_notes ? `: ${quote.admin_notes}` : '.'}`
              : quote
                ? 'Tienes un borrador sin enviar.'
                : 'Actividades, materiales y fotos del antes. Xpertos la revisa antes de enviarla al cliente.'
          }
          action={{ label: quoteAction, onPress: openQuote }}
        />
      </NextSteps>
    );
  } else if (service.status === 'quoting') {
    steps = (
      <NextSteps>
        <Step
          state="waiting"
          title={choosing ? 'El cliente está eligiendo la modalidad' : 'Xpertos está revisando tu cotización'}
          detail={
            choosing
              ? 'Xpertos aprobó tu cotización y se la presentó al cliente: elige entre solo mano de obra y todo incluido.'
              : 'Si hay algo por corregir te la devolverán con las notas.'
          }
          action={{ label: 'Ver tu cotización', onPress: () => reveal('quote') }}
        />
      </NextSteps>
    );
  } else if (service.status === 'pending_payment') {
    steps = (
      <NextSteps footer={`La obra inicia ${offset} días hábiles después de que Xpertos verifique el pago del cliente.`}>
        <Step
          state="waiting"
          title="Esperando el pago del cliente"
          detail={proofInReview ? 'El cliente subió el comprobante: Xpertos lo está verificando.' : 'Te avisaremos cuando Xpertos lo verifique.'}
        />
        {payoutStep}
      </NextSteps>
    );
  } else if (service.status === 'scheduled' && payoutStep && !payoutChosen) {
    steps = <NextSteps>{payoutStep}</NextSteps>;
  } else if (isExpert && service.status === 'in_progress') {
    steps = (
      <NextSteps>
        <Step
          state={todayLog?.check_in ? 'done' : 'todo'}
          title="Registra la jornada de hoy"
          detail={todayLog?.check_in ? 'Ya registraste la jornada de hoy.' : 'Hora de ingreso, hora de salida y fotos del trabajo.'}
          action={
            !todayLog?.check_in && canLogToday
              ? { label: 'Registrar jornada', onPress: () => router.push({ pathname: '/service/[id]/work/[date]', params: { id: service.id, date: today } }) }
              : null
          }
        />
        <Step
          state="todo"
          title="Cierra el trabajo cuando termines"
          detail="El servicio pasa a En observación y Xpertos verifica con el cliente en máximo 1 día hábil."
          action={{ label: 'Cerrar trabajo', onPress: () => reveal('close') }}
        />
      </NextSteps>
    );
  } else if (service.status === 'under_review') {
    steps = (
      <NextSteps>
        <Step
          state="waiting"
          title="Xpertos está verificando el trabajo con el cliente"
          detail={
            service.review_due_date
              ? `A más tardar el ${formatPlainDate(service.review_due_date)}. Al validarlo, el servicio se finaliza y se te paga.`
              : 'Al validarlo, el servicio se finaliza y se te paga.'
          }
        />
      </NextSteps>
    );
  } else if (service.status === 'completed' && !reviewed) {
    steps = (
      <NextSteps>
        <Step state="todo" title={`Califica a ${clientName}`} detail="Tu opinión ayuda a otros expertos." action={{ label: 'Calificar', onPress: () => reveal('review') }} />
      </NextSteps>
    );
  }

  return (
    <>
      <Collapsible
        primary
        title={service.title}
        subtitle={service.service_categories?.name ?? null}
        right={<Badge label={status.label} tone={status.tone} />}
        open={summaryOpen}
        onToggle={() => setSummaryOpen((v) => !v)}>
        <LifecycleProgress status={service.status} cancelledFrom={cancelledFrom} />
        {service.status === 'scheduled' ? <ScheduleCard service={service} schedule={schedule} /> : null}
        {steps ?? (
          <InfoBanner
            tone={service.status === 'paused' ? 'warning' : service.status === 'completed' ? 'success' : 'info'}
            message={serviceStatusHelp[service.status].expert}
          />
        )}
        {service.status === 'paused' && service.pause_reason ? <KeyValue label="Motivo de la pausa" value={service.pause_reason} /> : null}
        {service.status === 'cancelled' && service.cancel_reason ? (
          <KeyValue label="Motivo de la cancelación" value={service.cancel_reason} />
        ) : null}
        <Facts facts={facts} address={[service.address, service.city].filter(Boolean).join(', ')} />
      </Collapsible>

      <SectionList order={order} sections={sections} state={sectionState} />
    </>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  slots: { gap: spacing.xs },
  slotsLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slotText: { fontSize: 14, color: colors.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInfo: { flex: 1, minWidth: 160 },
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
