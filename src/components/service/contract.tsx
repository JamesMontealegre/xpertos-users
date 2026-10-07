import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { MarkdownView } from '@/components/markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorBanner } from '@/components/ui/screen';
import { colors, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatDateTime } from '@/lib/format';
import { contractStatus } from '@/lib/labels';
import { supabase } from '@/lib/supabase';

type Props = {
  contract: Tables<'contracts'>;
  signatures: Tables<'contract_signatures'>[];
  service: Tables<'services'>;
  userId: string;
  onChanged: () => Promise<void>;
};

export function ContractSection({ contract, signatures, service, userId, onChanged }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientSignature = signatures.find((s) => s.signer_id === service.client_id);
  const expertSignature = service.expert_id ? signatures.find((s) => s.signer_id === service.expert_id) : undefined;
  const mySignature = signatures.find((s) => s.signer_id === userId);
  const canSign = contract.status === 'pending_signatures' && !mySignature;
  const status = contractStatus[contract.status];

  const sign = async () => {
    setError(null);
    if (!accepted) return setError('Debes aceptar el contrato para firmarlo.');
    setSigning(true);
    const userAgent = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : `xpertos-app/${Platform.OS}`;
    const { error: rpcError } = await supabase.rpc('sign_contract', {
      p_contract_id: contract.id,
      p_body_hash: contract.body_hash,
      p_user_agent: userAgent,
    });
    setSigning(false);
    if (rpcError) return setError(`No se pudo firmar: ${rpcError.message}`);
    setAccepted(false);
    await onChanged();
  };

  return (
    <>
      <SectionTitle right={<Badge label={status.label} tone={status.tone} />}>Contrato</SectionTitle>
      <Card style={styles.card}>
        <ErrorBanner message={error} />
        <View style={styles.signatures}>
          <SignatureState label="Cliente" signature={clientSignature} />
          <SignatureState label="Experto" signature={expertSignature} />
        </View>
        <Text style={styles.meta}>
          Versión {contract.version} · Hash {contract.body_hash.slice(0, 12)}…
        </Text>

        <View style={[styles.body, !expanded && styles.bodyCollapsed]}>
          <MarkdownView>{contract.body_md}</MarkdownView>
        </View>
        <Button title={expanded ? 'Ver menos' : 'Leer contrato completo'} variant="ghost" size="sm" onPress={() => setExpanded((v) => !v)} />

        {canSign ? (
          <View style={styles.signBox}>
            <Checkbox checked={accepted} onChange={setAccepted} label="He leído y acepto este contrato" />
            <Button title="Firmar" onPress={sign} loading={signing} disabled={!accepted} />
            <Text style={styles.legal}>
              Tu aceptación, junto con la fecha, tu identificación y el hash del documento, constituye tu firma electrónica (Ley 527 de 1999).
            </Text>
          </View>
        ) : mySignature ? (
          <Text style={styles.signed}>Firmaste este contrato el {formatDateTime(mySignature.signed_at)}.</Text>
        ) : null}
      </Card>
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
});
