import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { MarkdownView } from '@/components/markdown';
import { IdentityForm } from '@/components/signature/identity-form';
import { SignSheet } from '@/components/signature/sign-sheet';
import { type SignatureData } from '@/components/signature/signature-pad';
import { SignaturePreview } from '@/components/signature/signature-preview';
import { saveMyIdentity, useMyIdentity } from '@/components/signature/use-identity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorBanner, InfoBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { downloadContractPdf } from '@/lib/contract-file';
import { formatDateTime } from '@/lib/format';
import { contractStatus, startedStatuses } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
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

/** En la web sin pantalla táctil (computador): se recomienda firmar desde el celular. */
const desktopWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !('ontouchstart' in window) && !(navigator.maxTouchPoints > 0);

export const userAgentLabel = () =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : `xpertos-app/${Platform.OS}`;

/** Título del contrato: la primera línea del Markdown ("# Contrato de prestación de servicios de …"). */
export const contractTitle = (bodyMd: string) => bodyMd.match(/^#\s+(.+)$/m)?.[1] ?? 'Contrato de prestación de servicios';

export function ContractSection({ contract, signatures, service, userId, onChanged, embedded }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const { toast } = useFeedback();
  const { profile } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const clientSignature = signatures.find((s) => s.signer_id === service.client_id);
  const mySignature = signatures.find((s) => s.signer_id === userId);
  const canSign = contract.status === 'pending_signatures' && !mySignature;
  const status = contractStatus[contract.status];
  // Se descarga en PDF con las firmas una vez firmado (o desde Programado, con el acta de inicio).
  const canDownload = contract.status !== 'void' && (Boolean(mySignature) || startedStatuses.includes(service.status));

  const { identity, reload: reloadIdentity } = useMyIdentity(userId, canSign);

  const download = async () => {
    setError(null);
    setDownloading(true);
    try {
      await downloadContractPdf({ contractId: contract.id });
    } catch (e) {
      setError(e instanceof Error ? `No se pudo descargar el contrato: ${e.message}` : 'No se pudo descargar el contrato.');
    } finally {
      setDownloading(false);
    }
  };

  const saveIdentity = async (documentType: string, documentNumber: string) => {
    const message = await saveMyIdentity(documentType, documentNumber);
    if (message) return message;
    // El contrato pendiente se regenera con el documento: se recarga antes de firmar.
    await Promise.all([reloadIdentity(), onChanged()]);
    toast('Documento guardado. Ya puedes firmar.', 'success');
    return null;
  };

  const openSheet = () => {
    setError(null);
    if (!accepted) return setError('Marca que leíste y aceptas el contrato para firmarlo.');
    setSheetOpen(true);
  };

  const sign = async (signature: SignatureData) => {
    const { error: rpcError } = await supabase.rpc('sign_contract', {
      p_contract_id: contract.id,
      p_body_hash: contract.body_hash,
      p_signature_svg: signature.path,
      p_signature_width: signature.width,
      p_signature_height: signature.height,
      p_user_agent: userAgentLabel(),
    });
    if (rpcError) return `No se pudo firmar: ${rpcError.message}`;
    setSheetOpen(false);
    setAccepted(false);
    toast('Contrato firmado. Ya puedes descargarlo en PDF con las firmas.', 'success');
    await onChanged();
    return null;
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
          {clientSignature?.signature_svg && clientSignature.signature_width && clientSignature.signature_height ? (
            <View style={styles.preview}>
              <SignaturePreview
                path={clientSignature.signature_svg}
                width={clientSignature.signature_width}
                height={clientSignature.signature_height}
              />
            </View>
          ) : null}
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
              title={mySignature ? 'Descargar contrato firmado (PDF)' : 'Descargar contrato (PDF)'}
              variant="outline"
              onPress={download}
              loading={downloading}
              disabled={!canDownload}
            />
            <Text style={styles.downloadHint}>
              {canDownload
                ? Platform.OS === 'web'
                  ? 'Se descarga el PDF con las firmas.'
                  : 'Se genera el PDF con las firmas para guardarlo o compartirlo.'
                : 'Podrás descargarlo en PDF, con las firmas, cuando lo firmes.'}
            </Text>
          </View>
        ) : null}

        {canSign ? (
          <View style={styles.signBox}>
            {identity === null ? (
              <IdentityForm onSubmit={saveIdentity} />
            ) : identity ? (
              <>
                <Text style={styles.legal}>También te lo enviamos al correo: puedes firmarlo desde allí con un código de verificación.</Text>
                {desktopWeb ? <InfoBanner message="Te recomendamos firmar desde tu celular: con el dedo la firma sale más natural." /> : null}
                <Checkbox checked={accepted} onChange={setAccepted} label="He leído y acepto este contrato" />
                <Button title="Firmar" onPress={openSheet} disabled={!accepted} />
                <Text style={styles.legal}>
                  Firmas a mano alzada en horizontal. Tu firma, junto con la fecha, tu IP, tu dispositivo y el código del documento,
                  constituye tu firma electrónica (Ley 527 de 1999).
                </Text>
              </>
            ) : null}
            <SignSheet
              visible={sheetOpen}
              title={contractTitle(contract.body_md)}
              statement={contract.statement}
              signerName={profile?.full_name ?? null}
              onCancel={() => setSheetOpen(false)}
              onConfirm={sign}
            />
          </View>
        ) : mySignature ? (
          <Text style={styles.signed}>Firmaste este contrato · {formatDateTime(mySignature.signed_at)}</Text>
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
  preview: { paddingLeft: 26 },
});
