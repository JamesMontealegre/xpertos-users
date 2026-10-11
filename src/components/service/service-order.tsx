import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { MarkdownView } from '@/components/markdown';
import { Button } from '@/components/ui/button';
import { SectionBody } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { downloadContract } from '@/lib/contract-file';
import { formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useFeedback } from '@/providers/feedback';

type Props = {
  order: Tables<'service_orders'>;
  /** Solo el experto asignado la acepta (un admin la ve en modo lectura). */
  canAccept: boolean;
  onChanged: () => Promise<void>;
  embedded?: boolean;
};

/**
 * Orden de servicio: lo que Xpertos le encarga al experto (trabajo, valor, comisión, lo que recibe, fechas y
 * obligaciones). El experto la lee y la acepta; cada versión nueva (p. ej. con la fecha de inicio) se acepta de nuevo.
 */
export function ServiceOrderSection({ order, canAccept, onChanged, embedded }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const { confirm, toast } = useFeedback();
  const pending = order.status === 'pending';

  const download = async () => {
    setError(null);
    setDownloading(true);
    try {
      await downloadContract(order, 'Orden de servicio Xpertos');
    } catch (e) {
      setError(e instanceof Error ? `No se pudo descargar la orden: ${e.message}` : 'No se pudo descargar la orden.');
    } finally {
      setDownloading(false);
    }
  };

  const accept = async () => {
    setError(null);
    if (!checked) return setError('Marca que leíste y aceptas la orden de servicio.');
    const ok = await confirm({
      title: 'Aceptar la orden de servicio',
      message: 'Tu aceptación en la app es tu firma electrónica: queda registrada con la fecha, tu IP y el código del documento.',
      confirmLabel: 'Aceptar orden',
    });
    if (!ok) return;
    setAccepting(true);
    const userAgent = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : `xpertos-app/${Platform.OS}`;
    const { error: rpcError } = await supabase.rpc('accept_service_order', {
      p_order_id: order.id,
      p_body_hash: order.body_hash,
      p_user_agent: userAgent,
    });
    setAccepting(false);
    if (rpcError) return setError(`No se pudo aceptar la orden: ${rpcError.message}`);
    toast('Orden de servicio aceptada. Ya puedes registrar tus jornadas.', 'success');
    setChecked(false);
    await onChanged();
  };

  return (
    <SectionBody plain={embedded} style={styles.card}>
      <ErrorBanner seq={errorSeq} message={error} />
      <Text style={styles.meta}>
        Versión {order.version} · Código {order.body_hash.slice(0, 12)}…
      </Text>
      <View style={[styles.body, !expanded && styles.bodyCollapsed]}>
        <MarkdownView>{order.body_md}</MarkdownView>
      </View>
      <Button title={expanded ? 'Ver menos' : 'Leer orden completa'} variant="ghost" size="sm" onPress={() => setExpanded((v) => !v)} />
      {order.status !== 'void' ? (
        <Button title="Descargar orden" variant="outline" onPress={download} loading={downloading} />
      ) : null}

      {pending && canAccept ? (
        <View style={styles.acceptBox}>
          <Checkbox checked={checked} onChange={setChecked} label="He leído y acepto esta orden de servicio" />
          <Button title="Aceptar orden de servicio" onPress={accept} loading={accepting} disabled={!checked} />
          <Text style={styles.legal}>
            Tu aceptación, junto con la fecha, tu IP y el hash del documento, constituye tu firma electrónica (Ley 527 de 1999).
            Debes aceptarla antes de registrar jornadas.
          </Text>
        </View>
      ) : order.status === 'accepted' && order.accepted_at ? (
        <Text style={styles.accepted}>Aceptaste esta orden · {formatDateTime(order.accepted_at)}</Text>
      ) : pending ? (
        <Text style={styles.legal}>Pendiente de aceptación del experto.</Text>
      ) : null}
    </SectionBody>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  meta: { fontSize: 12, color: colors.textMuted },
  body: { borderWidth: 1, borderColor: colors.border, borderRadius: radius, padding: spacing.md, backgroundColor: colors.background },
  bodyCollapsed: { maxHeight: 220, overflow: 'hidden' },
  acceptBox: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  legal: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  accepted: { fontSize: 14, color: colors.success, fontWeight: '600' },
});
