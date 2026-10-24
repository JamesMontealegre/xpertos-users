import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ContractSection } from '@/components/service/contract';
import { ServicePhotos } from '@/components/service/photos';
import { LifecycleProgress } from '@/components/service/progress';
import { QuoteOptions } from '@/components/service/quote-options';
import { QuoteSummary } from '@/components/service/quote-summary';
import { ReviewSection } from '@/components/service/review';
import { ScheduleCard } from '@/components/service/schedule';
import { startActOpen, StartActSection, startActSignatures } from '@/components/service/start-act';
import { StagesSection } from '@/components/service/stages';
import { Timeline } from '@/components/service/timeline';
import { daysLabel, Facts, NextSteps, SectionList, Step, useSections, type SectionSpec } from '@/components/service/sections';
import { WorkLogsSection } from '@/components/service/work-logs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KeyValue } from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import { InfoBanner } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums } from '@/lib/database.types';
import { formatCOP, formatDate, formatDateTime, formatPlainDate, todayCO } from '@/lib/format';
import { contractStatus, installmentFrequencyLabel, pricingModeLabel, serviceStatus, serviceStatusHelp, type Tone } from '@/lib/labels';
import { APPROVED_STATUSES, nextUnpaidStage, parseSlots, WORK_STATUSES, type ServiceDetail } from '@/lib/service-detail';

type SectionKey = 'payment' | 'contract' | 'act' | 'quote' | 'work' | 'review' | 'expert' | 'request' | 'history';

/**
 * Orden de las secciones según lo que más le sirve al cliente en cada estado: primero lo que tiene que hacer
 * (pagar, firmar, elegir, calificar), luego el detalle del servicio y al final el historial.
 */
const ORDER: Partial<Record<Enums<'service_status'>, SectionKey[]>> = {
  pending_payment: ['payment', 'contract', 'quote', 'expert', 'request', 'history'],
  scheduled: ['contract', 'act', 'quote', 'payment', 'expert', 'request', 'history'],
  in_progress: ['work', 'act', 'quote', 'contract', 'payment', 'expert', 'request', 'history'],
  paused: ['work', 'act', 'quote', 'contract', 'payment', 'expert', 'request', 'history'],
  under_review: ['work', 'quote', 'contract', 'act', 'payment', 'expert', 'request', 'history'],
  completed: ['review', 'work', 'quote', 'contract', 'act', 'payment', 'expert', 'request', 'history'],
};
const DEFAULT_ORDER: SectionKey[] = ['quote', 'expert', 'request', 'history'];

type Props = {
  detail: ServiceDetail;
  userId: string;
  onChanged: () => Promise<void>;
  onCancelRequest: () => void;
  cancelling: boolean;
};

/**
 * Detalle del servicio para el cliente: un resumen desplegado (estado, qué sigue y datos clave) y el resto en
 * secciones plegables, cerradas por defecto. Los botones de "Qué sigue" abren la sección y llevan hasta ella.
 */
export function ClientServiceView({ detail, userId, onChanged, onCancelRequest, cancelling }: Props) {
  const { service, quote, counterpart, contract, schedule } = detail;
  const [summaryOpen, setSummaryOpen] = useState(true);
  const sectionState = useSections<SectionKey>();
  const { reveal } = sectionState;

  const status = serviceStatus[service.status];
  const approved = APPROVED_STATUSES.includes(service.status);
  const hasWork = WORK_STATUSES.includes(service.status);
  const quoteReady = service.status === 'quoting' && quote?.status === 'approved' && quote.total == null;
  const total = service.estimated_price != null ? Number(service.estimated_price) : null;
  const stagesTotal = detail.stages.reduce((sum, s) => sum + Number(s.amount), 0);
  const cancelledFrom = [...detail.events].reverse().find((e) => e.type === 'status_change' && e.to_status === 'cancelled')?.from_status;
  const slots = parseSlots(service.availability);
  const expertName = counterpart?.full_name || 'tu experto';

  // Pago: lo pagado (verificado) se aplica en orden a los pagos del plan; el próximo es el primero sin cubrir.
  const proofInReview = detail.payments.some((p) => p.status === 'submitted');
  const paidAmount = detail.payments.filter((p) => p.status === 'verified').reduce((sum, p) => sum + Number(p.amount), 0);
  const paid = detail.stages.length > 0 && paidAmount >= stagesTotal;
  const advanceStages = detail.stages.filter((s) => s.kind !== 'installment');
  const advanceTotal = advanceStages.reduce((sum, s) => sum + Number(s.amount), 0);
  const installments = detail.stages.filter((s) => s.kind === 'installment');
  const nextStage = nextUnpaidStage(detail.stages, paidAmount)?.stage ?? null;
  const today = todayCO();
  const nextOverdue = Boolean(nextStage && nextStage.status !== 'pending' && nextStage.due_date && nextStage.due_date < today);
  const proofRejected = !paid && !proofInReview && nextStage?.status === 'rejected';
  const payment: { label: string; tone: Tone } = paid
    ? { label: 'Pagado', tone: 'green' }
    : proofInReview
      ? { label: 'En verificación', tone: 'blue' }
      : proofRejected
        ? { label: 'Rechazado', tone: 'red' }
        : nextOverdue
          ? { label: 'Pago vencido', tone: 'red' }
          : nextStage?.status === 'pending'
            ? { label: 'Al día', tone: 'green' }
            : { label: 'Por pagar', tone: 'amber' };
  // Cuota habilitada durante la obra (o vencida) que el cliente debe pagar ahora.
  const openInstallment = nextStage?.kind === 'installment' && ['awaiting_payment', 'rejected'].includes(nextStage.status) ? nextStage : null;
  const planLabel =
    detail.stages.length === 0
      ? null
      : installments.length === 0
        ? advanceStages.length > 1
          ? `Pago único en ${advanceStages.length} pagos`
          : 'Pago único'
        : `Anticipo y ${installments.length} ${installments.length === 1 ? 'cuota' : 'cuotas'}${
            service.installment_frequency ? ` ${installmentFrequencyLabel[service.installment_frequency]}` : ''
          }`;

  // Contrato: firmado por el cliente en la versión vigente.
  const signed = Boolean(contract && detail.signatures.some((s) => s.signer_id === userId && s.body_hash === contract.body_hash));
  const contractPending = Boolean(contract && contract.status === 'pending_signatures' && !signed);
  const startAct = Boolean(contract?.body_md.includes('acta de inicio'));
  const reviewed = detail.reviews.some((r) => r.author_id === userId);

  // Acta de inicio: la firman el cliente y el experto el día de inicio, antes de la primera jornada.
  const act = detail.startAct;
  const actSigs = act ? startActSignatures(act) : null;
  const actToSign = Boolean(act && startActOpen(act, service) && !actSigs?.client);

  const available: Record<SectionKey, boolean> = {
    payment: approved && detail.stages.length > 0,
    contract: Boolean(contract),
    act: Boolean(act) && act?.status !== 'void',
    quote: Boolean(quote) && (quoteReady || approved),
    work: hasWork,
    review: service.status === 'completed',
    expert: Boolean(counterpart),
    request: true,
    history: true,
  };
  const baseOrder = (ORDER[service.status] ?? DEFAULT_ORDER).filter((key) => available[key]);
  // Si toca firmar el acta, va primero.
  const order: SectionKey[] = actToSign ? ['act', ...baseOrder.filter((k) => k !== 'act')] : baseOrder;

  const offset = schedule?.start_offset_days ?? 2;
  const facts: [string, string | null][] = [
    ['Valor del servicio', approved && total != null ? formatCOP(total) : null],
    ['Modalidad', service.pricing_mode ? pricingModeLabel(service.pricing_mode) : null],
    ['Plan de pagos', approved ? planLabel : null],
    ['Experto asignado', counterpart?.full_name ?? null],
    ['Visita acordada', service.scheduled_at && ['assigned', 'quoting'].includes(service.status) ? formatDateTime(service.scheduled_at) : null],
    [
      'Inicio de obra',
      service.status === 'pending_payment'
        ? `${offset} días hábiles después de recibir ${installments.length > 0 ? 'el anticipo' : 'tu pago'}`
        : hasWork && schedule?.start_date
          ? formatPlainDate(schedule.start_date)
          : null,
    ],
    ['Duración estimada', service.status !== 'scheduled' && approved ? daysLabel(schedule?.estimated_days) : null],
    ['Terminación estimada', hasWork && schedule?.estimated_end_date ? formatPlainDate(schedule.estimated_end_date) : null],
    ['Trabajo cerrado', service.closed_at && hasWork ? formatDateTime(service.closed_at) : null],
    [
      'Verificación hasta',
      service.status === 'under_review' && service.review_due_date ? formatPlainDate(service.review_due_date) : null,
    ],
  ];

  const sections: Record<SectionKey, SectionSpec> = {
    payment: {
      title: 'Pago del servicio',
      subtitle: paid || paidAmount === 0 ? `Total ${formatCOP(stagesTotal)}` : `Pagado ${formatCOP(paidAmount)} de ${formatCOP(stagesTotal)}`,
      icon: 'card-outline',
      right: <Badge label={payment.label} tone={payment.tone} />,
      body: (
        <StagesSection
          service={service}
          stages={detail.stages}
          payments={detail.payments}
          accounts={detail.accounts}
          isClient
          userId={userId}
          onChanged={onChanged}
          embedded
        />
      ),
    },
    contract: {
      title: startAct ? 'Contrato y acta de inicio' : 'Contrato',
      subtitle: contract ? `Con Xpertos · versión ${contract.version}` : null,
      icon: 'document-text-outline',
      right: contract ? (
        <Badge label={contractStatus[contract.status].label} tone={contractStatus[contract.status].tone} />
      ) : null,
      body: contract ? (
        <ContractSection contract={contract} signatures={detail.signatures} service={service} userId={userId} onChanged={onChanged} embedded />
      ) : null,
    },
    act: {
      title: 'Acta de inicio',
      subtitle:
        act?.status === 'signed'
          ? 'Firmada por ti y el experto'
          : actSigs?.client
            ? 'Falta la firma del experto'
            : service.start_date
              ? `Se firma el ${formatPlainDate(service.start_date)}`
              : 'Se firma el día de inicio',
      icon: 'clipboard-outline',
      right: act ? (
        <Badge
          label={act.status === 'signed' ? 'Firmada' : actToSign ? 'Por firmar' : 'Pendiente'}
          tone={act.status === 'signed' ? 'green' : actToSign ? 'amber' : 'slate'}
        />
      ) : null,
      body: act ? <StartActSection act={act} service={service} userId={userId} onChanged={onChanged} /> : null,
    },
    quote: quoteReady
      ? {
          title: 'Elige tu cotización',
          subtitle: 'Solo mano de obra o todo incluido',
          icon: 'pricetags-outline',
          right: <Badge label="Por elegir" tone="amber" />,
          body: quote ? (
            <QuoteOptions
              serviceId={service.id}
              quote={quote}
              items={detail.items}
              materials={detail.materials}
              clientFeePct={Number(service.client_fee_pct)}
              onChosen={onChanged}
            />
          ) : null,
        }
      : {
          title: 'Cotización aprobada',
          subtitle: [service.pricing_mode ? pricingModeLabel(service.pricing_mode) : null, total != null ? formatCOP(total) : null]
            .filter(Boolean)
            .join(' · '),
          icon: 'pricetags-outline',
          body: quote ? (
            <QuoteSummary quote={quote} items={detail.items} materials={detail.materials} audience="client" clientFeePct={Number(service.client_fee_pct)} />
          ) : null,
        },
    work: {
      title: 'Jornadas de trabajo',
      subtitle: `${detail.logs.length} ${detail.logs.length === 1 ? 'jornada registrada' : 'jornadas registradas'}`,
      icon: 'construct-outline',
      body: (
        <>
          {service.closing_notes && ['under_review', 'completed'].includes(service.status) ? (
            <KeyValue label="Notas de cierre del experto" value={service.closing_notes} />
          ) : null}
          <WorkLogsSection service={service} schedule={schedule} logs={detail.logs} holidays={detail.holidays} editable={false} embedded />
        </>
      ),
    },
    review: {
      title: 'Calificación',
      subtitle: reviewed ? 'Ya calificaste el servicio' : `Califica a ${expertName}`,
      icon: 'star-outline',
      right: reviewed ? null : <Badge label="Pendiente" tone="amber" />,
      body: (
        <ReviewSection service={service} reviews={detail.reviews} userId={userId} counterpartName={expertName} onChanged={onChanged} embedded />
      ),
    },
    expert: {
      title: 'Experto asignado',
      subtitle: counterpart?.full_name ?? null,
      icon: 'person-outline',
      body: counterpart ? (
        <View style={styles.person}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={22} color={colors.primary} />
          </View>
          <View style={styles.personInfo}>
            <Text style={styles.personName}>{counterpart.full_name}</Text>
            <Text style={styles.personMeta}>
              Experto verificado de la red de Xpertos{counterpart.city ? ` · ${counterpart.city}` : ''}
            </Text>
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
      ) : null,
    },
    request: {
      title: 'Tu solicitud',
      subtitle: `Solicitada el ${formatDate(service.created_at)}`,
      icon: 'clipboard-outline',
      body: (
        <>
          <KeyValue label="Descripción" value={service.description} />
          <KeyValue label="Dirección" value={[service.address, service.city].filter(Boolean).join(', ')} />
          <KeyValue label="Solicitado" value={formatDateTime(service.created_at)} />
          {slots.length > 0 && ['requested', 'assigned', 'quoting'].includes(service.status) ? (
            <View style={styles.slots}>
              <Text style={styles.slotsLabel}>Tu disponibilidad</Text>
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

        {service.status === 'pending_payment' ? (
          <NextSteps
            title="Qué sigue"
            footer={`Cuando recibamos ${installments.length > 0 ? 'el anticipo' : 'el pago'}, el servicio pasa a Programado y la obra inicia ${offset} días hábiles después.`}>
            <Step
              state={paidAmount >= advanceTotal ? 'done' : proofInReview ? 'waiting' : proofRejected || nextOverdue ? 'alert' : 'todo'}
              title={installments.length > 0 ? `Paga el anticipo de ${formatCOP(advanceTotal)}` : `Paga ${formatCOP(advanceTotal)}`}
              detail={
                proofInReview
                  ? 'Recibimos tu comprobante: Xpertos lo está verificando en el banco.'
                  : proofRejected
                    ? 'Tu último comprobante fue rechazado. Revisa la nota y paga de nuevo.'
                    : advanceStages.length > 1
                      ? `En ${advanceStages.length} pagos, uno por día: en línea con tarjeta, PSE o Nequi, o por transferencia.${
                          paidAmount > 0 ? ` Llevas ${formatCOP(paidAmount)}.` : ''
                        }`
                      : 'En línea con tarjeta, PSE o Nequi, o por transferencia a las cuentas de Xpertos.'
              }
              action={!paid && !proofInReview ? { label: 'Ver cómo pagar', onPress: () => reveal('payment') } : null}
            />
            {contract ? (
              <Step
                state={signed ? 'done' : 'todo'}
                title="Firma el contrato"
                detail={signed ? 'Ya lo firmaste.' : 'Léelo y fírmalo aquí o desde el enlace que te enviamos al correo.'}
                action={signed ? null : { label: 'Leer y firmar', onPress: () => reveal('contract') }}
              />
            ) : null}
          </NextSteps>
        ) : null}

        {service.status === 'scheduled' ? <ScheduleCard service={service} schedule={schedule} /> : null}
        {actToSign ? (
          <NextSteps title="Qué sigue">
            <Step
              state="todo"
              title="Firma el acta de inicio con el experto"
              detail="Antes de la primera jornada: tú y el experto la firman a mano alzada, cada uno en su celular."
              action={{ label: 'Leer y firmar', onPress: () => reveal('act') }}
            />
          </NextSteps>
        ) : null}
        {openInstallment && hasWork ? (
          <NextSteps title="Qué sigue">
            <Step
              state={proofInReview ? 'waiting' : nextOverdue || proofRejected ? 'alert' : 'todo'}
              title={`Paga la ${openInstallment.name.toLowerCase()}: ${formatCOP(openInstallment.amount)}`}
              detail={
                proofInReview
                  ? 'Recibimos tu comprobante: Xpertos lo está verificando en el banco.'
                  : openInstallment.due_date
                    ? `${nextOverdue ? 'Venció' : 'Vence'} el ${formatPlainDate(openInstallment.due_date)}.${
                        nextOverdue ? ' Si no se paga, Xpertos puede pausar la obra.' : ''
                      }`
                    : 'En línea o por transferencia.'
              }
              action={proofInReview ? null : { label: 'Pagar', onPress: () => reveal('payment') }}
            />
          </NextSteps>
        ) : null}
        {service.status === 'scheduled' && contractPending ? (
          <NextSteps title="Qué sigue">
            <Step
              state="todo"
              title={startAct ? 'Firma el acta de inicio' : 'Firma el contrato'}
              detail="Léela y fírmala aquí o desde el enlace que te enviamos al correo."
              action={{ label: 'Leer y firmar', onPress: () => reveal('contract') }}
            />
          </NextSteps>
        ) : null}

        {quoteReady ? (
          <NextSteps title="Qué sigue">
            <Step
              state="todo"
              title="Elige cómo quieres el servicio"
              detail="Tu cotización está lista: revisa la mano de obra y los materiales, y elige solo mano de obra o todo incluido."
              action={{ label: 'Ver cotización', onPress: () => reveal('quote') }}
            />
          </NextSteps>
        ) : null}

        {service.status === 'completed' && !reviewed ? (
          <NextSteps title="Qué sigue">
            <Step
              state="todo"
              title={`Califica a ${expertName}`}
              detail={serviceStatusHelp.completed.client}
              action={{ label: 'Calificar', onPress: () => reveal('review') }}
            />
          </NextSteps>
        ) : null}

        {!['pending_payment', 'scheduled'].includes(service.status) && !quoteReady && !(service.status === 'completed' && !reviewed) ? (
          <InfoBanner
            tone={service.status === 'paused' ? 'warning' : service.status === 'completed' ? 'success' : 'info'}
            message={
              service.status === 'under_review'
                ? `${serviceStatusHelp.under_review.client} Xpertos te contactará en máximo 1 día hábil.`
                : serviceStatusHelp[service.status].client
            }
          />
        ) : null}
        {service.status === 'paused' && service.pause_reason ? <KeyValue label="Motivo de la pausa" value={service.pause_reason} /> : null}
        {service.status === 'cancelled' && service.cancel_reason ? (
          <KeyValue label="Motivo de la cancelación" value={service.cancel_reason} />
        ) : null}

        <Facts facts={facts} address={[service.address, service.city].filter(Boolean).join(', ')} />

        {service.status === 'requested' ? (
          <Button title="Cancelar solicitud" variant="danger" loading={cancelling} onPress={onCancelRequest} />
        ) : null}
      </Collapsible>

      <SectionList order={order} sections={sections} state={sectionState} />
    </>
  );
}

const styles = StyleSheet.create({
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
