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
import { supabase } from '@/lib/supabase';
import { extensionForMime, extensionOf, signedUrl, timestamp, uploadFile } from '@/lib/upload';

type Props = {
  service: Tables<'services'>;
  stages: Tables<'service_stages'>[];
  payments: Tables<'payments'>[];
  isClient: boolean;
  userId: string;
  onChanged: () => Promise<void>;
};

// Datos de la cuenta recaudadora (placeholder para el piloto).
const BANK_ACCOUNT = {
  bank: 'Bancolombia',
  type: 'Cuenta de ahorros',
  number: '000-000000-00',
  holder: 'Xpertos S.A.S.',
  nit: '900.000.000-0',
};

export function StagesSection({ service, stages, payments, isClient, userId, onChanged }: Props) {
  const [uploadingStage, setUploadingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);


  const uploadProof = async (stage: Tables<'service_stages'>) => {
    setError(null);
    setNotice(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingStage(stage.id);
    try {
      const ext = extensionOf(asset.name) || extensionForMime(asset.mimeType, 'bin');
      const path = `${userId}/${service.id}/${timestamp()}.${ext}`;
      await uploadFile('payment-proofs', path, { uri: asset.uri, mimeType: asset.mimeType, name: asset.name });
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
      setNotice('Comprobante enviado. El operador lo verificará pronto.');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? `No se pudo registrar el pago: ${e.message}` : 'No se pudo registrar el pago.');
    } finally {
      setUploadingStage(null);
    }
  };

  const openProof = async (payment: Tables<'payments'>) => {
    if (!payment.proof_path) return;
    const url = await signedUrl('payment-proofs', payment.proof_path);
    if (!url) return setError('No pudimos abrir el comprobante.');
    Linking.openURL(url);
  };

  if (stages.length === 0) return null;

  const total = stages.reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <>
      <SectionTitle right={<Text style={styles.total}>Total {formatCOP(total)}</Text>}>Etapas de pago</SectionTitle>
      <ErrorBanner message={error} />
      {notice ? <InfoBanner tone="success" message={notice} /> : null}
      {stages.map((stage) => {
        const status = stageStatus[stage.status];
        const stagePayments = payments.filter((p) => p.stage_id === stage.id);
        const canPay = isClient && (stage.status === 'awaiting_payment' || stage.status === 'rejected');
        return (
          <Card key={stage.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.titleWrap}>
                <Text style={styles.position}>Etapa {stage.position}</Text>
                <Text style={styles.name}>{stage.name}</Text>
              </View>
              <Badge label={status.label} tone={status.tone} />
            </View>
            {stage.description ? <Text style={styles.description}>{stage.description}</Text> : null}
            <View style={styles.row}>
              <Text style={styles.amount}>{formatCOP(stage.amount)}</Text>
              {stage.due_date ? <Text style={styles.due}>Vence {formatDate(stage.due_date)}</Text> : null}
            </View>

            {canPay ? (
              <View style={styles.payBox}>
                <Text style={styles.payTitle}>
                  {stage.status === 'rejected' ? 'Tu comprobante fue rechazado. Vuelve a intentarlo:' : 'Cómo pagar esta etapa'}
                </Text>
                <Text style={styles.payText}>
                  Transfiere {formatCOP(stage.amount)} a la cuenta de Xpertos y sube el comprobante (imagen o PDF).
                </Text>
                <View style={styles.account}>
                  <Text style={styles.accountLine}>{BANK_ACCOUNT.bank} · {BANK_ACCOUNT.type}</Text>
                  <Text style={styles.accountNumber}>{BANK_ACCOUNT.number}</Text>
                  <Text style={styles.accountLine}>
                    {BANK_ACCOUNT.holder} · NIT {BANK_ACCOUNT.nit}
                  </Text>
                  <Text style={styles.accountLine}>Referencia: {service.id.slice(0, 8).toUpperCase()}</Text>
                </View>
                <Button
                  title="Subir comprobante"
                  variant="secondary"
                  onPress={() => uploadProof(stage)}
                  loading={uploadingStage === stage.id}
                />
              </View>
            ) : null}

            {stagePayments.length > 0 ? (
              <View style={styles.payments}>
                <Text style={styles.paymentsTitle}>Comprobantes</Text>
                {stagePayments.map((payment) => {
                  const pStatus = paymentStatus[payment.status];
                  return (
                    <View key={payment.id} style={styles.paymentRow}>
                      <Pressable
                        accessibilityRole="link"
                        onPress={() => openProof(payment)}
                        disabled={!payment.proof_path || !isClient}
                        style={styles.paymentInfo}>
                        <View style={styles.paymentHead}>
                          <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                          <Text style={styles.paymentAmount}>{formatCOP(payment.amount)}</Text>
                          <Badge label={pStatus.label} tone={pStatus.tone} />
                        </View>
                        <Text style={styles.paymentDate}>{formatDateTime(payment.created_at)}</Text>
                        {payment.notes ? <Text style={styles.paymentNote}>Nota: {payment.notes}</Text> : null}
                      </Pressable>
                    </View>
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
  titleWrap: { flex: 1 },
  position: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  description: { fontSize: 14, color: colors.textMuted },
  amount: { fontSize: 20, fontWeight: '800', color: colors.text },
  due: { fontSize: 13, color: colors.textMuted },
  payBox: { backgroundColor: colors.accentSoft, borderRadius: radius, padding: spacing.md, gap: spacing.sm },
  payTitle: { fontWeight: '700', color: colors.text, fontSize: 14 },
  payText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  account: { backgroundColor: colors.surface, borderRadius: radius, padding: spacing.sm, gap: 2 },
  accountLine: { fontSize: 13, color: colors.textMuted },
  accountNumber: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  payments: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  paymentsTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  paymentRow: { paddingVertical: spacing.xs },
  paymentInfo: { gap: 2 },
  paymentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  paymentAmount: { fontWeight: '700', color: colors.text },
  paymentDate: { fontSize: 12, color: colors.textMuted },
  paymentNote: { fontSize: 13, color: colors.danger },
});
