import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ComponentProps } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ContractSection } from '@/components/service/contract';
import { ServicePhotos } from '@/components/service/photos';
import { LifecycleProgress } from '@/components/service/progress';
import { QuoteOptions } from '@/components/service/quote-options';
import { QuoteSummary } from '@/components/service/quote-summary';
import { ReviewSection } from '@/components/service/review';
import { ScheduleCard } from '@/components/service/schedule';
import { StagesSection } from '@/components/service/stages';
import { Timeline } from '@/components/service/timeline';
import { WorkLogsSection } from '@/components/service/work-logs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KeyValue } from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import { InfoBanner, useScreenScroll } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums } from '@/lib/database.types';
import { formatCOP, formatDate, formatDateTime, formatPlainDate } from '@/lib/format';
import { contractStatus, pricingModeLabel, serviceStatus, serviceStatusHelp, type Tone } from '@/lib/labels';
import { APPROVED_STATUSES, parseSlots, WORK_STATUSES, type ServiceDetail } from '@/lib/service-detail';

type SectionKey = 'payment' | 'contract' | 'quote' | 'work' | 'review' | 'expert' | 'request' | 'history';
type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Orden de las secciones según lo que más le sirve al cliente en cada estado: primero lo que tiene que hacer
 * (pagar, firmar, elegir, calificar), luego el detalle del servicio y al final el historial.
 */
const ORDER: Partial<Record<Enums<'service_status'>, SectionKey[]>> = {
  pending_payment: ['payment', 'contract', 'quote', 'expert', 'request', 'history'],
  scheduled: ['contract', 'quote', 'payment', 'expert', 'request', 'history'],
  in_progress: ['work', 'quote', 'contract', 'payment', 'expert', 'request', 'history'],
  paused: ['work', 'quote', 'contract', 'payment', 'expert', 'request', 'history'],
  under_review: ['work', 'quote', 'contract', 'payment', 'expert', 'request', 'history'],
  completed: ['review', 'work', 'quote', 'contract', 'payment', 'expert', 'request', 'history'],
};
const DEFAULT_ORDER: SectionKey[] = ['quote', 'expert', 'request', 'history'];

function daysLabel(n: number | null | undefined): string | null {
  return n == null ? null : `${n} ${n === 1 ? 'día hábil' : 'días hábiles'}`;
}

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
  const { scrollToY } = useScreenScroll();
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [open, setOpen] = useState<Partial<Record<SectionKey, boolean>>>({});
  const positions = useRef<Partial<Record<SectionKey, number>>>({});

  const toggle = (key: SectionKey) => setOpen((current) => ({ ...current, [key]: !current[key] }));
  const reveal = (key: SectionKey) => {
    setOpen((current) => ({ ...current, [key]: true }));
    // Después de abrirla: antes el contenido aún no tiene la altura para llegar hasta la sección.
    setTimeout(() => {
      const y = positions.current[key];
      if (y != null) scrollToY(y);
    }, 120);
  };

  const status = serviceStatus[service.status];
  const approved = APPROVED_STATUSES.includes(service.status);
  const hasWork = WORK_STATUSES.includes(service.status);
  const quoteReady = service.status === 'quoting' && quote?.status === 'approved' && quote.total == null;
  const total = service.estimated_price != null ? Number(service.estimated_price) : null;
  const stagesTotal = detail.stages.reduce((sum, s) => sum + Number(s.amount), 0);
  const cancelledFrom = [...detail.events].reverse().find((e) => e.type === 'status_change' && e.to_status === 'cancelled')?.from_status;
  const slots = parseSlots(service.availability);
  const expertName = counterpart?.full_name || 'tu experto';

  // Pago: por pagar, en verificación, rechazado o pagado.
  const proofInReview = detail.payments.some((p) => p.status === 'submitted');
  const paid = detail.stages.length > 0 && detail.stages.every((s) => s.status === 'paid');
  const proofRejected = !paid && !proofInReview && detail.stages.some((s) => s.status === 'rejected');
  const payment: { label: string; tone: Tone } = paid
    ? { label: 'Pagado', tone: 'green' }
    : proofInReview
      ? { label: 'En verificación', tone: 'blue' }
      : proofRejected
        ? { label: 'Rechazado', tone: 'red' }
        : { label: 'Por pagar', tone: 'amber' };

  // Contrato: firmado por el cliente en la versión vigente.
  const signed = Boolean(contract && detail.signatures.some((s) => s.signer_id === userId && s.body_hash === contract.body_hash));
  const contractPending = Boolean(contract && contract.status === 'pending_signatures' && !signed);
  const startAct = Boolean(contract?.body_md.includes('acta de inicio'));
  const reviewed = detail.reviews.some((r) => r.author_id === userId);

  const available: Record<SectionKey, boolean> = {
    payment: approved && detail.stages.length > 0,
    contract: Boolean(contract),
    quote: Boolean(quote) && (quoteReady || approved),
    work: hasWork,
    review: service.status === 'completed',
    expert: Boolean(counterpart),
    request: true,
    history: true,
  };
  const order = (ORDER[service.status] ?? DEFAULT_ORDER).filter((key) => available[key]);

  const offset = schedule?.start_offset_days ?? 2;
  const facts: [string, string | null][] = [
    ['Valor del servicio', approved && total != null ? formatCOP(total) : null],
    ['Modalidad', service.pricing_mode ? pricingModeLabel(service.pricing_mode) : null],
    ['Experto asignado', counterpart?.full_name ?? null],
    ['Visita acordada', service.scheduled_at && ['assigned', 'quoting'].includes(service.status) ? formatDateTime(service.scheduled_at) : null],
    [
      'Inicio de obra',
      service.status === 'pending_payment'
        ? `${offset} días hábiles después de verificar tu pago`
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

  const sections: Record<SectionKey, { title: string; subtitle?: string | null; icon: IconName; right?: React.ReactNode; body: React.ReactNode }> = {
    payment: {
      title: 'Pago del servicio',
      subtitle: `Total ${formatCOP(stagesTotal)}`,
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
            footer={`Cuando Xpertos verifique el pago, el servicio pasa a Programado y la obra inicia ${offset} días hábiles después.`}>
            <Step
              state={paid ? 'done' : proofInReview ? 'waiting' : proofRejected ? 'alert' : 'todo'}
              title={total != null ? `Paga ${formatCOP(total)} y sube el comprobante` : 'Paga y sube el comprobante'}
              detail={
                proofInReview
                  ? 'Recibimos tu comprobante: Xpertos lo está verificando en el banco.'
                  : proofRejected
                    ? 'Tu último comprobante fue rechazado. Revisa la nota y sube otro.'
                    : 'Transfiere a una de las cuentas de Xpertos y sube la foto del comprobante.'
              }
              action={!paid && !proofInReview ? { label: proofRejected ? 'Subir otro comprobante' : 'Ver cómo pagar', onPress: () => reveal('payment') } : null}
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

        <View style={styles.facts}>
          {facts
            .filter((fact): fact is [string, string] => Boolean(fact[1]))
            .map(([label, value]) => (
              <View key={label} style={styles.fact}>
                <KeyValue label={label} value={value} />
              </View>
            ))}
          <View style={styles.factWide}>
            <KeyValue label="Dirección" value={[service.address, service.city].filter(Boolean).join(', ')} />
          </View>
        </View>

        {service.status === 'requested' ? (
          <Button title="Cancelar solicitud" variant="danger" loading={cancelling} onPress={onCancelRequest} />
        ) : null}
      </Collapsible>

      {order.map((key) => {
        const section = sections[key];
        return (
          <Collapsible
            key={key}
            title={section.title}
            subtitle={section.subtitle}
            icon={section.icon}
            right={section.right}
            open={Boolean(open[key])}
            onToggle={() => toggle(key)}
            onLayout={(e) => {
              positions.current[key] = e.nativeEvent.layout.y;
            }}>
            {section.body}
          </Collapsible>
        );
      })}
    </>
  );
}

function NextSteps({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={styles.next}>
      <Text style={styles.nextTitle}>{title}</Text>
      {children}
      {footer ? <Text style={styles.nextFooter}>{footer}</Text> : null}
    </View>
  );
}

const STEP_ICON: Record<'todo' | 'waiting' | 'alert' | 'done', { name: IconName; color: string }> = {
  todo: { name: 'ellipse-outline', color: colors.primary },
  waiting: { name: 'hourglass-outline', color: colors.info },
  alert: { name: 'alert-circle', color: colors.danger },
  done: { name: 'checkmark-circle', color: colors.success },
};

function Step({
  state,
  title,
  detail,
  action,
}: {
  state: keyof typeof STEP_ICON;
  title: string;
  detail: string;
  action?: { label: string; onPress: () => void } | null;
}) {
  const icon = STEP_ICON[state];
  return (
    <View style={styles.step}>
      <Ionicons name={icon.name} size={22} color={icon.color} />
      <View style={styles.stepText}>
        <Text style={[styles.stepTitle, state === 'done' && styles.stepDone]}>{title}</Text>
        <Text style={styles.stepDetail}>{detail}</Text>
        {action ? (
          <View style={styles.stepAction}>
            <Button title={action.label} size="sm" variant="secondary" onPress={action.onPress} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  next: { backgroundColor: colors.primarySoft, borderRadius: radius, padding: spacing.md, gap: spacing.md },
  nextTitle: { fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  nextFooter: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  stepDone: { color: colors.textMuted },
  stepDetail: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  stepAction: { alignSelf: 'flex-start', marginTop: spacing.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, columnGap: spacing.md },
  fact: { flexGrow: 1, flexBasis: '45%', minWidth: 140 },
  factWide: { flexBasis: '100%' },
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
