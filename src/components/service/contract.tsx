import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { MarkdownView } from '@/components/markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { downloadContract } from '@/lib/contract-file';
import { formatDateTime } from '@/lib/format';
import { contractStatus, startedStatuses } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useFeedback } from '@/providers/feedback';

type Props = {
  contract: Tables<'contracts'>;
  signatures: Tables<'contract_signatures'>[];
  service: Tables<'services'>;
  userId: string;
  onChanged: () => Promise<void>;
  /** Dentro de una sección plegable: sin título ni tarjeta propia. */
  embedded?: boolean;
};

export function ContractSection({ contract, signatures, service, userId, onChanged, embedded }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const { confirm, toast } = useFeedback();
  const [downloading, setDownloading] = useState(false);

  const clientSignature = signatures.find((s) => s.signer_id === service.client_id);
  const mySignature = signatures.find((s) => s.signer_id === userId);
  const canSign = contract.status === 'pending_signatures' && !mySignature;
  const status = contractStatus[contract.status];
  // El contrato de inicio ("acta de inicio") se descarga desde Programado, cuando ya hay pago verificado.
  const canDownload = startedStatuses.includes(service.status) && contract.status !== 'void';

  const download = async () => {
    setError(null);
    setDownloading(true);
    try {
      await downloadContract(contract);
    } catch (e) {
      setError(e instanceof Error ? `No se pudo descargar el contrato: ${e.message}` : 'No se pudo descargar el contrato.');
    } finally {
      setDownloading(false);
    }
  };

  const sign = async () => {
    setError(null);
    if (!accepted) return setError('Debes aceptar el contrato para firmarlo.');
    const ok = await confirm({
      title: 'Firmar el contrato',
      message: 'Tu aceptación en la app es tu firma electrónica: queda registrada con la fecha, tu IP y el código del documento.',
      confirmLabel: 'Firmar',
    });
    if (!ok) return;
    setSigning(true);
    const userAgent = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : `xpertos-app/${Platform.OS}`;
    const { error: rpcError } = await supabase.rpc('sign_contract', {
      p_contract_id: contract.id,
      p_body_hash: contract.body_hash,
      p_user_agent: userAgent,
    });
    setSigning(false);
    if (rpcError) return setError(`No se pudo firmar: ${rpcError.message}`);
    toast('Contrato firmado.', 'success');
    setAccepted(false);
    await onChanged();
  };

  return (
    <>
      {embedded ? null : <SectionTitle right={<Badge label={status.label} tone={status.tone} />}>Contrato</SectionTitle>}
      <SectionBody plain={embedded} style={styles.card}>
        <ErrorBanner seq={errorSeq} message={error} />
        <View style={styles.signatures}>
          {/* Contrato entre Xpertos y el cliente: Xpertos lo emite y acepta; queda firmado cuando firma el cliente. */}
          <View style={styles.signature}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.signatureText}>Xpertos: emitido y aceptado</Text>
          </View>
          <SignatureState label="Tú (cliente)" signature={clientSignature} />
        </View>
        <Text style={styles.meta}>
          Versión {contract.version} · Hash {contract.body_hash.slice(0, 12)}…
        </Text>

        <View style={[styles.body, !expanded && styles.bodyCollapsed]}>
          <MarkdownView>{contract.body_md}</MarkdownView>
        </View>
        <Button title={expanded ? 'Ver menos' : 'Leer contrato completo'} variant="ghost" size="sm" onPress={() => setExpanded((v) => !v)} />

        {contract.status !== 'void' ? (
          <View style={styles.downloadBox}>
            <Button
              title="Descargar contrato"
              variant="outline"
              onPress={download}
              loading={downloading}
              disabled={!canDownload}
            />
            <Text style={styles.downloadHint}>
              {canDownload
                ? Platform.OS === 'web'
                  ? 'Se abre el diálogo de impresión: elige «Guardar como PDF».'
                  : 'Se genera un PDF que puedes guardar o compartir.'
                : 'La descarga del contrato de inicio se habilita cuando Xpertos confirme el pago.'}
            </Text>
          </View>
        ) : null}

        {canSign ? (
          <View style={styles.signBox}>
            <Text style={styles.legal}>También te lo enviamos al correo: puedes firmarlo desde allí con un código de verificación.</Text>
            <Checkbox checked={accepted} onChange={setAccepted} label="He leído y acepto este contrato" />
            <Button title="Firmar" onPress={sign} loading={signing} disabled={!accepted} />
            <Text style={styles.legal}>
              Tu aceptación, junto con la fecha, tu identificación y el hash del documento, constituye tu firma electrónica (Ley 527 de 1999).
            </Text>
          </View>
        ) : mySignature ? (
          <Text style={styles.signed}>Firmaste este contrato el {formatDateTime(mySignature.signed_at)}.</Text>
        ) : null}
      </SectionBody>
    </>
  );
}

function SignatureState({ label, signature }: { label: string; signature?: Tables<'contract_signatures'> }) {
  return (
    <View style={styles.signature}>
      <Ionicons
        name={signature ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={signature ? colors.success : colors.textMuted}
      />
      <Text style={styles.signatureText}>
        {label}: {signature ? `firmado ${formatDateTime(signature.signed_at)}` : 'pendiente'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  signatures: { gap: spacing.xs },
  signature: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  signatureText: { fontSize: 14, color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  body: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, backgroundColor: colors.background },
  bodyCollapsed: { maxHeight: 220, overflow: 'hidden' },
  signBox: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  legal: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  signed: { fontSize: 14, color: colors.success, fontWeight: '600' },
  downloadBox: { gap: spacing.xs },
  downloadHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 17 },
});
