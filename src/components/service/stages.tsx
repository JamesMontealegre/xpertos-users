import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionTitle } from '@/components/ui/card';
import { ErrorBanner, InfoBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums, Tables } from '@/lib/database.types';
import { formatCOP, formatDateTime, formatPlainDate, todayCO } from '@/lib/format';
import { paymentStatus, type Tone } from '@/lib/labels';
import { pickImages } from '@/lib/photos';
import { nextUnpaidStage } from '@/lib/service-detail';
import { supabase } from '@/lib/supabase';
import { extensionForMime, extensionOf, signedUrl, timestamp, uploadFile, type LocalFile } from '@/lib/upload';
import { useFeedback } from '@/providers/feedback';

type Props = {
  service: Tables<'services'>;
  stages: Tables<'service_stages'>[];
  payments: Tables<'payments'>[];
  accounts: Tables<'payment_accounts'>[];
  isClient: boolean;
  userId: string;
  onChanged: () => Promise<void>;
  /** Dentro de una sección plegable: sin título ni tarjeta propia. */
  embedded?: boolean;
};

type PlanRow = { pos: number; stage_kind: string; stage_name: string; stage_amount: number; end_day: number | null };
type PlanOptions = {
  total: number;
  estimated_days: number | null;
  max_payment: number;
  advance_pct: number;
  can_single: boolean;
  frequencies: Enums<'installment_frequency'>[];
  plan: Enums<'payment_plan'> | null;
  frequency: Enums<'installment_frequency'> | null;
  can_change: boolean;
  previews: Record<string, PlanRow[]>;
};
type PlanKey = 'single' | 'auto' | Enums<'installment_frequency'>;

const PLAN_LABEL: Record<PlanKey, string> = {
  single: 'Pago único',
  auto: 'Anticipo y cuotas',
  weekly: 'Anticipo y cuotas semanales',
  biweekly: 'Anticipo y cuotas quincenales',
  monthly: 'Anticipo y cuotas mensuales',
};

/** "Anticipo $ 6.000.000 (3 pagos) + 6 cuotas de $ 2.333.000". */
function planSummary(rows: PlanRow[] | undefined): string {
  if (!rows?.length) return '';
  if (rows.length === 1) return `Un pago de ${formatCOP(rows[0].stage_amount)}`;
  const advance = rows.filter((r) => r.stage_kind === 'advance');
  const cuotas = rows.filter((r) => r.stage_kind === 'installment');
  const advanceTotal = advance.reduce((s, r) => s + Number(r.stage_amount), 0);
  return `Anticipo de ${formatCOP(advanceTotal)}${advance.length > 1 ? ` (${advance.length} pagos)` : ''} y ${cuotas.length} ${
    cuotas.length === 1 ? 'cuota' : 'cuotas'
  } de ${formatCOP(cuotas[0]?.stage_amount ?? 0)}`;
}

async function invokeErrorMessage(error: unknown, fallback: string): Promise<string> {
  try {
    const body = await (error as { context?: Response }).context?.json();
    if (body?.error) return String(body.error);
  } catch {
    // sin cuerpo legible
  }
  return fallback;
}

/**
 * Pagos del cliente: el plan de pagos (se puede cambiar antes del primer pago), el próximo pago (en línea con Wompi o
 * por transferencia), el avance y los pagos hechos. Lo pagado se aplica en orden a los pagos del plan.
 */
export function StagesSection({ service, stages, payments, accounts, isClient, userId, onChanged, embedded }: Props) {
  const [error, setError, errorSeq] = useErrorState();
  const { confirm, toast } = useFeedback();
  const [online, setOnline] = useState<{ enabled: boolean; max_payment: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transferAmount, setTransferAmount] = useState<'next' | 'advance' | 'all'>('next');

  useEffect(() => {
    if (!isClient) return;
    let active = true;
    supabase.functions.invoke('wompi-checkout', { body: { action: 'config' } }).then(({ data }) => {
      if (active && data) setOnline(data as { enabled: boolean; max_payment: number });
    });
    return () => {
      active = false;
    };
  }, [isClient]);

  if (stages.length === 0) return null;

  // Avance: lo pagado (verificado) se aplica en orden a los pagos del plan.
  const total = stages.reduce((sum, s) => sum + Number(s.amount), 0);
  const paid = payments.filter((p) => p.status === 'verified').reduce((sum, p) => sum + Number(p.amount), 0);
  const pending = Math.max(total - paid, 0);
  const nextInfo = nextUnpaidStage(stages, paid);
  const next = nextInfo?.stage ?? null;
  const nextRemaining = nextInfo?.remaining ?? 0;
  const advanceCumulative = stages.filter((s) => s.kind !== 'installment').reduce((sum, s) => sum + Number(s.amount), 0);
  const advanceRemaining = Math.max(advanceCumulative - paid, 0);
  const inReview = payments.some((p) => p.status === 'submitted');
  const today = todayCO();
  const onlineAmount = online ? Math.min(nextRemaining, online.max_payment) : nextRemaining;
  // Wompi como agregador permite un pago en línea por cliente al día; la función lo valida de nuevo.
  const paidOnlineToday = payments.some(
    (p) => p.method === 'wompi' && p.status === 'verified' && new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) === today
  );
  const transferValue = transferAmount === 'all' ? pending : transferAmount === 'advance' ? advanceRemaining : nextRemaining;
  const reference = service.id.slice(0, 8).toUpperCase();
  // Las cuotas futuras (aún no habilitadas) se pueden adelantar; las vencidas se marcan.
  const payable = isClient && Boolean(next) && !inReview && service.status !== 'cancelled' && service.status !== 'completed';

  const payOnline = async () => {
    setError(null);
    const ok = await confirm({
      title: 'Pagar en línea',
      message: `Te llevamos a Wompi para pagar ${formatCOP(onlineAmount)} con tarjeta, PSE, Nequi u otros medios. Al terminar vuelves a la app.`,
      confirmLabel: 'Ir a pagar',
    });
    if (!ok) return;
    setPaying(true);
    const { data, error: invokeError } = await supabase.functions.invoke('wompi-checkout', { body: { service_id: service.id } });
    setPaying(false);
    if (invokeError) return setError(await invokeErrorMessage(invokeError, 'No pudimos abrir el pago en línea. Intenta de nuevo.'));
    const url = (data as { url?: string } | null)?.url;
    if (!url) return setError('No pudimos abrir el pago en línea. Intenta de nuevo.');
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(url);
    else await Linking.openURL(url);
  };

  const registerProof = async (file: LocalFile) => {
    if (!next) return;
    const ok = await confirm({
      title: 'Enviar el comprobante',
      message: `Enviaremos ${file.name ? `"${file.name}"` : 'el comprobante'} por ${formatCOP(transferValue)}. Xpertos lo verificará en el banco.`,
      confirmLabel: 'Enviar comprobante',
    });
    if (!ok) return;
    setUploading(true);
    try {
      const ext = extensionOf(file.name ?? '') || extensionForMime(file.mimeType, 'jpg');
      const path = `${userId}/${service.id}/${timestamp()}.${ext}`;
      await uploadFile('payment-proofs', path, file);
      const { error: insertError } = await supabase.from('payments').insert({
        stage_id: next.id,
        service_id: service.id,
        client_id: userId,
        amount: transferValue,
        method: 'transfer',
        proof_path: path,
        status: 'submitted',
      });
      if (insertError) throw new Error(insertError.message);
      toast('Comprobante enviado. Xpertos verificará el pago en el banco y te avisaremos.', 'success');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? `No se pudo registrar el pago: ${e.message}` : 'No se pudo registrar el pago.');
    } finally {
      setUploading(false);
    }
  };

  const uploadPhoto = async () => {
    setError(null);
    const [file] = await pickImages(1);
    if (file) await registerProof(file);
  };

  const uploadDocument = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await registerProof({ uri: asset.uri, mimeType: asset.mimeType, name: asset.name });
  };

  const openProof = async (payment: Tables<'payments'>) => {
    if (!payment.proof_path) return;
    const url = await signedUrl('payment-proofs', payment.proof_path);
    if (!url) return setError('No pudimos abrir el comprobante.');
    Linking.openURL(url);
  };

  const stageState = (stage: Tables<'service_stages'>): { label: string; tone: Tone; detail?: string } => {
    if (stage.status === 'paid') return { label: 'Pagado', tone: 'green' };
    if (stage.status === 'proof_uploaded') return { label: 'En verificación', tone: 'blue' };
    if (stage.status === 'pending') {
      return { label: 'Durante la obra', tone: 'slate', detail: stage.opens_on ? `Se habilita el ${formatPlainDate(stage.opens_on)}` : undefined };
    }
    const overdue = stage.due_date != null && stage.due_date < today;
    return {
      label: overdue ? 'Vencido' : stage.status === 'rejected' ? 'Rechazado' : 'Por pagar',
      tone: overdue || stage.status === 'rejected' ? 'red' : 'amber',
      detail: stage.due_date ? `${overdue ? 'Venció' : 'Vence'} el ${formatPlainDate(stage.due_date)}` : stage.kind === 'advance' ? 'Antes del inicio' : undefined,
    };
  };

  return (
    <>
      {embedded ? null : <SectionTitle right={<Text style={styles.total}>Total {formatCOP(total)}</Text>}>Pago del servicio</SectionTitle>}
      <SectionBody plain={embedded} style={styles.card}>
        <ErrorBanner seq={errorSeq} message={error} />

        <View style={styles.progressHead}>
          <Text style={styles.progressText}>
            Pagado <Text style={styles.progressStrong}>{formatCOP(paid)}</Text> de {formatCOP(total)}
          </Text>
          {pending > 0 ? <Text style={styles.progressPending}>Falta {formatCOP(pending)}</Text> : null}
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${total > 0 ? Math.min(100, (paid / total) * 100) : 0}%` }]} />
        </View>

        {isClient && service.status === 'pending_payment' ? <PlanChooser serviceId={service.id} onChanged={onChanged} /> : null}

        {next && isClient ? (
          <View style={styles.payBox}>
            <View style={styles.row}>
              <View style={styles.titleWrap}>
                <Text style={styles.payLabel}>Próximo pago</Text>
                <Text style={styles.name}>{next.name}</Text>
                {stageState(next).detail ? <Text style={styles.description}>{stageState(next).detail}</Text> : null}
              </View>
              <Text style={styles.amount}>{formatCOP(nextRemaining)}</Text>
            </View>

            {inReview ? (
              <InfoBanner message="Recibimos tu comprobante. Xpertos lo está verificando en el banco; te avisamos cuando quede confirmado." />
            ) : payable ? (
              <>
                {next.status === 'rejected' ? (
                  <View style={styles.rejected}>
                    <Ionicons name="alert-circle" size={18} color={colors.danger} />
                    <Text style={styles.rejectedText}>
                      Tu último comprobante fue rechazado
                      {payments.find((p) => p.status === 'rejected')?.notes ? `: ${payments.find((p) => p.status === 'rejected')?.notes}` : '.'}{' '}
                      Paga de nuevo.
                    </Text>
                  </View>
                ) : null}

                {online?.enabled && paidOnlineToday ? (
                  <InfoBanner message="Ya hiciste tu pago en línea de hoy. Mañana puedes pagar el siguiente en línea, o hoy mismo por transferencia." />
                ) : online?.enabled ? (
                  <>
                    <Button title={`Pagar en línea ${formatCOP(onlineAmount)}`} onPress={payOnline} loading={paying} />
                    <Text style={styles.payHint}>
                      Tarjeta, PSE, Nequi y otros medios con Wompi.
                      {nextRemaining > online.max_payment
                        ? ` Cada pago en línea es de máximo ${formatCOP(online.max_payment)} (uno por día); el resto lo pagas otro día o por transferencia.`
                        : ' Un pago en línea por día.'}
                    </Text>
                  </>
                ) : null}

                <Text style={styles.payTitle}>{online?.enabled ? 'O por transferencia' : 'Por transferencia'}</Text>
                {advanceRemaining > nextRemaining || pending > nextRemaining ? (
                  <View style={styles.choices} accessibilityRole="radiogroup">
                    <AmountChoice label="Este pago" value={nextRemaining} selected={transferAmount === 'next'} onPress={() => setTransferAmount('next')} />
                    {service.status === 'pending_payment' && advanceRemaining > nextRemaining ? (
                      <AmountChoice
                        label="Todo el anticipo"
                        value={advanceRemaining}
                        selected={transferAmount === 'advance'}
                        onPress={() => setTransferAmount('advance')}
                      />
                    ) : null}
                    {pending > Math.max(nextRemaining, advanceRemaining) || (service.status !== 'pending_payment' && pending > nextRemaining) ? (
                      <AmountChoice label="Todo lo pendiente" value={pending} selected={transferAmount === 'all'} onPress={() => setTransferAmount('all')} />
                    ) : null}
                  </View>
                ) : null}
                <Text style={styles.payText}>
                  Transfiere o consigna {formatCOP(transferValue)} a una de estas cuentas de Xpertos y sube la foto o captura del comprobante.
                </Text>
                {accounts.length === 0 ? (
                  <Text style={styles.payText}>Xpertos te compartirá los datos de pago.</Text>
                ) : (
                  accounts.map((account) => (
                    <View key={account.id} style={styles.account}>
                      <Text style={styles.accountBank}>
                        {account.bank} · {account.account_type}
                      </Text>
                      <Text style={styles.accountNumber} selectable>
                        {account.account_number}
                      </Text>
                      <Text style={styles.accountLine}>
                        {account.holder}
                        {account.holder_id ? ` · ${account.holder_id}` : ''}
                      </Text>
                    </View>
                  ))
                )}
                <Text style={styles.reference}>
                  Referencia del pago: <Text style={styles.referenceValue}>{reference}</Text>
                </Text>
                <Button title="Subir comprobante" variant="secondary" onPress={uploadPhoto} loading={uploading} />
                <Pressable accessibilityRole="button" onPress={uploadDocument} disabled={uploading}>
                  <Text style={styles.altLink}>¿Tienes el comprobante en PDF? Adjuntar archivo</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.listTitle}>Plan de pagos</Text>
        {stages.map((stage) => {
          const state = stageState(stage);
          return (
            <View key={stage.id} style={styles.stageRow}>
              <View style={styles.titleWrap}>
                <Text style={styles.stageName}>{stage.name}</Text>
                {state.detail ? <Text style={styles.stageDetail}>{state.detail}</Text> : null}
              </View>
              <View style={styles.stageRight}>
                <Text style={styles.stageAmount}>{formatCOP(stage.amount)}</Text>
                <Badge label={state.label} tone={state.tone} />
              </View>
            </View>
          );
        })}

        {payments.length > 0 ? (
          <View style={styles.payments}>
            <Text style={styles.listTitle}>Pagos realizados</Text>
            {payments.map((payment) => {
              const pStatus = paymentStatus[payment.status];
              return (
                <Pressable
                  key={payment.id}
                  accessibilityRole="link"
                  onPress={() => openProof(payment)}
                  disabled={!payment.proof_path || !isClient}
                  style={styles.paymentRow}>
                  <View style={styles.paymentHead}>
                    <Ionicons name={payment.method === 'wompi' ? 'card-outline' : 'receipt-outline'} size={16} color={colors.primary} />
                    <Text style={styles.paymentAmount}>{formatCOP(payment.amount)}</Text>
                    <Text style={styles.paymentMethod}>{payment.method === 'wompi' ? 'En línea' : 'Transferencia'}</Text>
                    <Badge label={pStatus.label} tone={pStatus.tone} />
                  </View>
                  <Text style={styles.paymentDate}>{formatDateTime(payment.created_at)}</Text>
                  {payment.notes && payment.status === 'rejected' ? <Text style={styles.paymentNote}>Nota: {payment.notes}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </SectionBody>
    </>
  );
}

function AmountChoice({ label, value, selected, onPress }: { label: string; value: number; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${label}: ${formatCOP(value)}`}
      aria-checked={selected}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? colors.primary : colors.textMuted} />
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
      <Text style={styles.choiceValue}>{formatCOP(value)}</Text>
    </Pressable>
  );
}

/** Elegir el plan antes del primer pago (pago único o anticipo y cuotas, según el valor y la duración de la obra). */
function PlanChooser({ serviceId, onChanged }: { serviceId: string; onChanged: () => Promise<void> }) {
  const { confirm, toast } = useFeedback();
  const [options, setOptions] = useState<PlanOptions | null>(null);
  const [choice, setChoice] = useState<PlanKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError, errorSeq] = useErrorState();

  useEffect(() => {
    let active = true;
    supabase.rpc('payment_plan_options', { p_service_id: serviceId }).then(({ data }) => {
      if (active && data) setOptions(data as unknown as PlanOptions);
    });
    return () => {
      active = false;
    };
  }, [serviceId]);

  if (!options || !options.can_change) return null;
  // Si el tope por pago obliga a más cuotas, una frecuencia puede dar el mismo plan que otra opción: se muestra una vez.
  const seen = new Set<string>();
  const keys = ([options.can_single ? 'single' : 'auto', ...options.frequencies] as PlanKey[]).filter((key) => {
    const summary = planSummary(options.previews[key]);
    if (!summary || seen.has(summary)) return false;
    seen.add(summary);
    return true;
  });
  if (keys.length < 2) return null; // una sola opción posible: no hay nada que elegir
  const chosen: PlanKey = options.plan === 'installments' ? (options.frequency ?? 'auto') : 'single';
  const current = keys.find((key) => planSummary(options.previews[key]) === planSummary(options.previews[chosen])) ?? chosen;
  const selected = choice ?? current;

  const save = async () => {
    setError(null);
    const ok = await confirm({
      title: 'Cambiar el plan de pagos',
      message: `${PLAN_LABEL[selected]}: ${planSummary(options.previews[selected])}. El contrato se actualiza con el nuevo plan.`,
      confirmLabel: 'Usar este plan',
    });
    if (!ok) return;
    setSaving(true);
    const { error: rpcError } = await supabase.rpc('choose_payment_plan', {
      p_service_id: serviceId,
      p_plan: selected === 'single' ? 'single' : 'installments',
      p_frequency: selected === 'single' || selected === 'auto' ? undefined : selected,
    });
    setSaving(false);
    if (rpcError) return setError(`No pudimos cambiar el plan: ${rpcError.message}`);
    toast('Plan de pagos actualizado.', 'success');
    setChoice(null);
    await onChanged();
  };

  return (
    <View style={styles.planBox}>
      <Text style={styles.payTitle}>¿Cómo quieres pagar?</Text>
      <Text style={styles.payHint}>
        Puedes cambiarlo hasta hacer el primer pago. Sin recargo. Ningún pago supera {formatCOP(options.max_payment)}, el tope de los pagos en
        línea.
      </Text>
      <ErrorBanner seq={errorSeq} message={error} />
      <View style={styles.choices} accessibilityRole="radiogroup">
        {keys.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={`${PLAN_LABEL[key]}: ${planSummary(options.previews[key])}`}
            aria-checked={selected === key}
            onPress={() => setChoice(key)}
            style={[styles.planOption, selected === key && styles.choiceSelected]}>
            <Ionicons name={selected === key ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected === key ? colors.primary : colors.textMuted} />
            <View style={styles.titleWrap}>
              <Text style={[styles.choiceLabel, selected === key && styles.choiceLabelSelected]}>{PLAN_LABEL[key]}</Text>
              <Text style={styles.stageDetail}>{planSummary(options.previews[key])}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      {selected !== current ? <Button title="Usar este plan" variant="secondary" onPress={save} loading={saving} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  total: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  card: { gap: spacing.sm },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  progressText: { fontSize: 14, color: colors.textMuted },
  progressStrong: { fontWeight: '800', color: colors.text },
  progressPending: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.success },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  titleWrap: { flex: 1, gap: 2 },
  payLabel: { fontSize: 12, fontWeight: '800', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.4 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  description: { fontSize: 13, color: colors.textMuted },
  amount: { fontSize: 22, fontWeight: '800', color: colors.text },
  payBox: { backgroundColor: colors.accentSoft, borderRadius: radius, padding: spacing.md, gap: spacing.sm },
  planBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius, padding: spacing.md, gap: spacing.sm },
  rejected: { flexDirection: 'row', gap: spacing.xs, backgroundColor: colors.dangerSoft, borderRadius: radius, padding: spacing.sm },
  rejectedText: { flex: 1, color: colors.danger, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  payTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  payText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  payHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  choices: { gap: spacing.xs },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  choiceLabelSelected: { color: colors.primary },
  choiceValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  account: { backgroundColor: colors.surface, borderRadius: radius, padding: spacing.sm, gap: 2 },
  accountBank: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  accountNumber: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  accountLine: { fontSize: 13, color: colors.textMuted },
  reference: { fontSize: 13, color: colors.text },
  referenceValue: { fontWeight: '800', letterSpacing: 1 },
  altLink: { color: colors.primary, fontWeight: '600', fontSize: 14, textAlign: 'center', paddingVertical: 4 },
  listTitle: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.xs },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stageName: { fontSize: 14, fontWeight: '600', color: colors.text },
  stageDetail: { fontSize: 12, color: colors.textMuted },
  stageRight: { alignItems: 'flex-end', gap: 4 },
  stageAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
  payments: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  paymentRow: { paddingVertical: spacing.xs, gap: 2 },
  paymentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  paymentAmount: { fontWeight: '700', color: colors.text },
  paymentMethod: { fontSize: 13, color: colors.textMuted },
  paymentDate: { fontSize: 12, color: colors.textMuted },
  paymentNote: { fontSize: 13, color: colors.danger },
});
