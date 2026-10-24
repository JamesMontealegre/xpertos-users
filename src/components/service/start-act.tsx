import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { MarkdownView } from '@/components/markdown';
import { userAgentLabel } from '@/components/service/contract';
import { IdentityForm } from '@/components/signature/identity-form';
import { SignSheet } from '@/components/signature/sign-sheet';
import { type SignatureData } from '@/components/signature/signature-pad';
import { SignaturePreview } from '@/components/signature/signature-preview';
import { saveMyIdentity, useMyIdentity } from '@/components/signature/use-identity';
import { Button } from '@/components/ui/button';
import { SectionBody } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorBanner, InfoBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { downloadContractPdf } from '@/lib/contract-file';
import { formatDateTime, formatPlainDate, todayCO } from '@/lib/format';
import type { StartActDetail } from '@/lib/service-detail';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import { useFeedback } from '@/providers/feedback';

type Props = {
  act: StartActDetail;
  service: Tables<'services'>;
  userId: string;
  onChanged: () => Promise<void>;
};

/** En la web sin pantalla táctil (computador): se recomienda firmar desde el celular. */
const desktopWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !('ontouchstart' in window) && !(navigator.maxTouchPoints > 0);

/** El acta de inicio se firma desde la fecha de inicio, en estos estados. */
export function startActOpen(act: StartActDetail | null, service: Tables<'services'>): boolean {
  return (
    act?.status === 'pending_signatures' &&
    Boolean(service.start_date) &&
    todayCO() >= (service.start_date ?? '') &&
    ['scheduled', 'in_progress', 'paused'].includes(service.status)
  );
}

/** Firmas vigentes del acta (de su versión actual) por rol. */
export function startActSignatures(act: StartActDetail) {
  const current = act.start_act_signatures.filter((s) => s.body_hash === act.body_hash);
  return { client: current.find((s) => s.signer_role === 'client'), expert: current.find((s) => s.signer_role === 'expert') };
}

/**
 * Acta de inicio de obra: la firman a mano alzada el cliente y el experto, cada uno en su app, el día de inicio y
 * antes de la primera jornada. Sin ella firmada por los dos no se registran jornadas.
 */
export function StartActSection({ act, service, userId, onChanged }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const { toast } = useFeedback();
  const { profile } = useAuth();

  const role = userId === service.client_id ? 'client' : userId === service.expert_id ? 'expert' : null;
  const signatures = startActSignatures(act);
  const mine = role ? signatures[role] : undefined;
  const other = role === 'client' ? 'el experto' : 'el cliente';
  const canSign = Boolean(role) && !mine && startActOpen(act, service);
  const { identity, reload: reloadIdentity } = useMyIdentity(userId, canSign);

  const download = async () => {
    setError(null);
    setDownloading(true);
    try {
      await downloadContractPdf({ startActId: act.id });
    } catch (e) {
      setError(e instanceof Error ? `No se pudo descargar el acta: ${e.message}` : 'No se pudo descargar el acta.');
    } finally {
      setDownloading(false);
    }
  };

  const saveIdentity = async (documentType: string, documentNumber: string) => {
    const message = await saveMyIdentity(documentType, documentNumber);
    if (message) return message;
    await reloadIdentity();
    toast('Documento guardado. Ya puedes firmar.', 'success');
    return null;
  };

  const openSheet = () => {
    setError(null);
    if (!accepted) return setError('Marca que leíste el acta para firmarla.');
    setSheetOpen(true);
  };

  const sign = async (signature: SignatureData) => {
    const { error: rpcError } = await supabase.rpc('sign_start_act', {
      p_act_id: act.id,
      p_body_hash: act.body_hash,
      p_signature_svg: signature.path,
      p_signature_width: signature.width,
      p_signature_height: signature.height,
      p_user_agent: userAgentLabel(),
    });
    if (rpcError) return `No se pudo firmar: ${rpcError.message}`;
    setSheetOpen(false);
    setAccepted(false);
    toast(signatures[role === 'client' ? 'expert' : 'client'] ? 'Acta de inicio firmada por los dos.' : `Firmaste el acta. Falta la firma de ${other}.`, 'success');
    await onChanged();
    return null;
  };

  return (
    <SectionBody plain style={styles.card}>
      <ErrorBanner seq={errorSeq} message={error} />
      <View style={styles.signatures}>
        <SignatureRow label={role === 'client' ? 'Tú (cliente)' : 'Cliente'} signature={signatures.client} />
        <SignatureRow label={role === 'expert' ? 'Tú (experto)' : 'Experto'} signature={signatures.expert} />
      </View>
      <Text style={styles.meta}>
        Versión {act.version} · Hash {act.body_hash.slice(0, 12)}…
      </Text>

      <View style={[styles.body, !expanded && styles.bodyCollapsed]}>
        <MarkdownView>{act.body_md}</MarkdownView>
      </View>
      <Button title={expanded ? 'Ver menos' : 'Leer acta completa'} variant="ghost" size="sm" onPress={() => setExpanded((v) => !v)} />

      {act.status !== 'void' ? (
        <Button
          title={act.status === 'signed' ? 'Descargar acta firmada (PDF)' : 'Descargar acta (PDF)'}
          variant="outline"
          onPress={download}
          loading={downloading}
        />
      ) : null}

      {act.status === 'signed' ? (
        <Text style={styles.signed}>
          Acta firmada por los dos{act.signed_at ? ` · ${formatDateTime(act.signed_at)}` : ''}. Ya se pueden registrar las jornadas.
        </Text>
      ) : act.status === 'void' ? (
        <Text style={styles.meta}>Esta acta quedó anulada.</Text>
      ) : mine ? (
        <Text style={styles.signed}>Firmaste el acta · {formatDateTime(mine.signed_at)}. Falta la firma de {other}.</Text>
      ) : !role ? null : !canSign ? (
        <InfoBanner
          message={`El acta se firma ${service.start_date ? `el ${formatPlainDate(service.start_date)}` : 'el día de inicio'}, en el lugar y antes de la primera jornada: tú y ${other} la firman a mano alzada, cada uno en su celular.`}
        />
      ) : (
        <View style={styles.signBox}>
          {identity === null ? (
            <IdentityForm onSubmit={saveIdentity} />
          ) : identity ? (
            <>
              {desktopWeb ? <InfoBanner message="Te recomendamos firmar desde tu celular: con el dedo la firma sale más natural." /> : null}
              <Checkbox checked={accepted} onChange={setAccepted} label="Leí el acta y estoy de acuerdo" />
              <Button title="Firmar acta de inicio" onPress={openSheet} disabled={!accepted} />
              <Text style={styles.legal}>
                Firman los dos, cada uno en su celular, antes de la primera jornada. Tu firma, junto con la fecha, tu IP, tu dispositivo y
                el código del documento, constituye tu firma electrónica (Ley 527 de 1999).
              </Text>
            </>
          ) : null}
          <SignSheet
            visible={sheetOpen}
            title="Acta de inicio de obra"
            statement={act.statement}
            signerName={profile?.full_name ?? null}
            confirmLabel="Firmar acta"
            onCancel={() => setSheetOpen(false)}
            onConfirm={sign}
          />
        </View>
      )}
    </SectionBody>
  );
}

function SignatureRow({ label, signature }: { label: string; signature?: Tables<'start_act_signatures'> }) {
  return (
    <View style={styles.signatureBlock}>
      <View style={styles.signature}>
        <Ionicons name={signature ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={signature ? colors.success : colors.textMuted} />
        <Text style={styles.signatureText}>
          {label}: {signature ? `firmó ${formatDateTime(signature.signed_at)}` : 'pendiente'}
        </Text>
      </View>
      {signature ? (
        <View style={styles.preview}>
          <SignaturePreview path={signature.signature_svg} width={signature.signature_width} height={signature.signature_height} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  signatures: { gap: spacing.xs },
  signatureBlock: { gap: 2 },
  signature: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  signatureText: { fontSize: 14, color: colors.text },
  preview: { paddingLeft: 26 },
  meta: { fontSize: 12, color: colors.textMuted },
  body: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, backgroundColor: colors.background },
  bodyCollapsed: { maxHeight: 220, overflow: 'hidden' },
  signBox: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  legal: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  signed: { fontSize: 14, color: colors.success, fontWeight: '600' },
});
