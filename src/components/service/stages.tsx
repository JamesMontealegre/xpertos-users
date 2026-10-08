import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { ErrorBanner, InfoBanner } from '@/components/ui/screen';
import { colors, radius, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatCOP, formatDate, formatDateTime } from '@/lib/format';
import { paymentStatus, stageStatus } from '@/lib/labels';
import { pickImages } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { extensionForMime, extensionOf, signedUrl, timestamp, uploadFile, type LocalFile } from '@/lib/upload';

type Props = {
  service: Tables<'services'>;
  stages: Tables<'service_stages'>[];
  payments: Tables<'payments'>[];
  accounts: Tables<'payment_accounts'>[];
  isClient: boolean;
  userId: string;
  onChanged: () => Promise<void>;
};

/** Cobro del servicio (un único pago tras aprobar la cotización), cuentas de recaudo y comprobantes. */
export function StagesSection({ service, stages, payments, accounts, isClient, userId, onChanged }: Props) {
  const [uploadingStage, setUploadingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const registerProof = async (stage: Tables<'service_stages'>, file: LocalFile) => {
    setUploadingStage(stage.id);
    try {
      const ext = extensionOf(file.name ?? '') || extensionForMime(file.mimeType, 'jpg');
      const path = `${userId}/${service.id}/${timestamp()}.${ext}`;
      await uploadFile('payment-proofs', path, file);
      const { error: insertError } = await supabase.from('payments').insert({
        stage_id: stage.id,
        service_id: service.id,
        client_id: userId,
        amount: Number(stage.amount),
        method: 'transfer',
        proof_path: path,
        status: 'submitted',
      });
      if (insertError) throw new Error(insertError.message);
      setNotice('Comprobante enviado. Xpertos verificará el pago en el banco y el estado cambiará a Programado.');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? `No se pudo registrar el pago: ${e.message}` : 'No se pudo registrar el pago.');
    } finally {
      setUploadingStage(null);
    }
  };

  const uploadPhoto = async (stage: Tables<'service_stages'>) => {
    setError(null);
    setNotice(null);
    const [file] = await pickImages(1);
    if (file) await registerProof(stage, file);
  };

  const uploadDocument = async (stage: Tables<'service_stages'>) => {
    setError(null);
    setNotice(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await registerProof(stage, { uri: asset.uri, mimeType: asset.mimeType, name: asset.name });
  };

  const openProof = async (payment: Tables<'payments'>) => {
    if (!payment.proof_path) return;
    const url = await signedUrl('payment-proofs', payment.proof_path);
    if (!url) return setError('No pudimos abrir el comprobante.');
    Linking.openURL(url);
  };

  if (stages.length === 0) return null;

  const total = stages.reduce((sum, s) => sum + Number(s.amount), 0);
  const reference = service.id.slice(0, 8).toUpperCase();

  return (
    <>
      <SectionTitle right={<Text style={styles.total}>Total {formatCOP(total)}</Text>}>Pago del servicio</SectionTitle>
      <ErrorBanner message={error} />
      {notice ? <InfoBanner tone="success" message={notice} /> : null}
      {stages.map((stage) => {
        const status = stageStatus[stage.status];
        const stagePayments = payments.filter((p) => p.stage_id === stage.id);
        const lastRejected = stagePayments.find((p) => p.status === 'rejected');
        const waitingVerification = stagePayments.some((p) => p.status === 'submitted');
        const canPay = isClient && (stage.status === 'awaiting_payment' || stage.status === 'rejected') && !waitingVerification;
        return (
          <Card key={stage.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.titleWrap}>
                <Text style={styles.name}>{stage.name}</Text>
                {stage.description ? <Text style={styles.description}>{stage.description}</Text> : null}
              </View>
              <Badge label={status.label} tone={status.tone} />
            </View>
            <View style={styles.row}>
              <Text style={styles.amount}>{formatCOP(stage.amount)}</Text>
              {stage.due_date ? <Text style={styles.due}>Vence {formatDate(stage.due_date)}</Text> : null}
            </View>

            {isClient && waitingVerification ? (
              <InfoBanner message="Recibimos tu comprobante. El estado cambia a Programado cuando Xpertos verifique el pago en el banco." />
            ) : null}

            {canPay ? (
              <View style={styles.payBox}>
                {stage.status === 'rejected' || lastRejected ? (
                  <View style={styles.rejected}>
                    <Ionicons name="alert-circle" size={18} color={colors.danger} />
                    <Text style={styles.rejectedText}>
                      Tu comprobante fue rechazado{lastRejected?.notes ? `: ${lastRejected.notes}` : '.'} Sube otro comprobante.
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.payTitle}>Cómo pagar</Text>
                <Text style={styles.payText}>
                  Transfiere o consigna {formatCOP(stage.amount)} a una de estas cuentas de Xpertos y sube la foto o captura del
                  comprobante.
                </Text>
                {accounts.length === 0 ? (
                  <Text style={styles.payText}>Xpertos te compartirá los datos de pago. Escríbenos si no los has recibido.</Text>
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
                <Button
                  title="Subir comprobante"
                  variant="secondary"
                  onPress={() => uploadPhoto(stage)}
                  loading={uploadingStage === stage.id}
                />
                <Pressable accessibilityRole="button" onPress={() => uploadDocument(stage)} disabled={uploadingStage !== null}>
                  <Text style={styles.altLink}>¿Tienes el comprobante en PDF? Adjuntar archivo</Text>
                </Pressable>
                <Text style={styles.payHint}>
                  El servicio sigue Pendiente de pago hasta que Xpertos verifique la transacción en el banco; luego pasa a Programado.
                </Text>
              </View>
            ) : null}

            {stagePayments.length > 0 ? (
              <View style={styles.payments}>
                <Text style={styles.paymentsTitle}>Comprobantes</Text>
                {stagePayments.map((payment) => {
                  const pStatus = paymentStatus[payment.status];
                  return (
                    <Pressable
                      key={payment.id}
                      accessibilityRole="link"
                      onPress={() => openProof(payment)}
                      disabled={!payment.proof_path || !isClient}
                      style={styles.paymentRow}>
                      <View style={styles.paymentHead}>
                        <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                        <Text style={styles.paymentAmount}>{formatCOP(payment.amount)}</Text>
                        <Badge label={pStatus.label} tone={pStatus.tone} />
                      </View>
                      <Text style={styles.paymentDate}>{formatDateTime(payment.created_at)}</Text>
                      {payment.notes ? <Text style={styles.paymentNote}>Nota: {payment.notes}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  total: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  titleWrap: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  description: { fontSize: 14, color: colors.textMuted },
  amount: { fontSize: 22, fontWeight: '800', color: colors.text },
  due: { fontSize: 13, color: colors.textMuted },
  payBox: { backgroundColor: colors.accentSoft, borderRadius: radius, padding: spacing.md, gap: spacing.sm },
  rejected: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius,
    padding: spacing.sm,
  },
  rejectedText: { flex: 1, color: colors.danger, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  payTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  payText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  account: { backgroundColor: colors.surface, borderRadius: radius, padding: spacing.sm, gap: 2 },
  accountBank: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  accountNumber: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  accountLine: { fontSize: 13, color: colors.textMuted },
  reference: { fontSize: 13, color: colors.text },
  referenceValue: { fontWeight: '800', letterSpacing: 1 },
  altLink: { color: colors.primary, fontWeight: '600', fontSize: 14, textAlign: 'center', paddingVertical: 4 },
  payHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  payments: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  paymentsTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  paymentRow: { paddingVertical: spacing.xs, gap: 2 },
  paymentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  paymentAmount: { fontWeight: '700', color: colors.text },
  paymentDate: { fontSize: 12, color: colors.textMuted },
  paymentNote: { fontSize: 13, color: colors.danger },
});
