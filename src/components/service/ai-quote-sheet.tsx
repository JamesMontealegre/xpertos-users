import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorBanner, InfoBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import { formatCOP, quantityToInput } from '@/lib/format';
import { pickImages, resizeForAi, takePhoto, uploadServicePhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { LocalFile } from '@/lib/upload';

export type AiActivity = {
  description: string;
  measure_a: number | null;
  measure_b: number | null;
  measure_unit: string | null;
  quantity: number;
  unit: string;
  unit_price: number | null;
  needs_review: boolean;
  note: string | null;
};
export type AiMaterial = { name: string; quantity: number; unit: string; estimated_cost: number | null; needs_review: boolean; note: string | null };
type AiResult = {
  run_id: string | null;
  kind: 'written_quote' | 'site_photo' | 'mixed' | 'unreadable';
  summary: string;
  warnings: string[];
  estimated_days: number | null;
  activities: AiActivity[];
  materials: AiMaterial[];
};

type Props = {
  visible: boolean;
  serviceId: string;
  userId: string;
  onClose: () => void;
  /** Lo que el experto confirmó: se agrega a su cotización (no la reemplaza). */
  onApply: (picked: { activities: AiActivity[]; materials: AiMaterial[]; estimatedDays: number | null }) => void;
};

const MAX_PHOTOS = 3;

const KIND_LABEL: Record<AiResult['kind'], string> = {
  written_quote: 'Leímos tu cotización escrita',
  site_photo: 'Propuesta según las fotos del lugar',
  mixed: 'Leímos tu lista y las fotos del lugar',
  unreadable: 'No pudimos leer las fotos',
};

function measureText(a: AiActivity): string | null {
  if (!a.measure_a) return null;
  return `${[a.measure_a, a.measure_b].filter(Boolean).map((n) => quantityToInput(n as number)).join(' × ')} ${a.measure_unit ?? 'm'}`;
}

/**
 * Armar la cotización con IA: el experto toma o elige hasta 3 fotos (su cotización o lista escrita, o el lugar del
 * trabajo), la IA propone actividades y materiales, y él elige qué agregar. Nada se guarda hasta que guarde la
 * cotización.
 */
export function AiQuoteSheet({ visible, serviceId, userId, onClose, onApply }: Props) {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [skipActivities, setSkipActivities] = useState<Set<number>>(new Set());
  const [skipMaterials, setSkipMaterials] = useState<Set<number>>(new Set());
  const [error, setError, errorSeq] = useErrorState();

  const reset = () => {
    setFiles([]);
    setResult(null);
    setSkipActivities(new Set());
    setSkipMaterials(new Set());
    setError(null);
  };

  const close = () => {
    if (analyzing) return;
    reset();
    onClose();
  };

  const addPhotos = async (source: 'camera' | 'gallery') => {
    setError(null);
    try {
      const picked =
        source === 'camera' ? [await takePhoto()].filter((f): f is LocalFile => f !== null) : await pickImages(MAX_PHOTOS - files.length);
      if (!picked.length) return;
      setPreparing(true);
      const resized = await Promise.all(picked.slice(0, MAX_PHOTOS - files.length).map(resizeForAi));
      setFiles((prev) => [...prev, ...resized].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos abrir la foto.');
    } finally {
      setPreparing(false);
    }
  };

  const analyze = async () => {
    setError(null);
    setAnalyzing(true);
    try {
      const paths = await Promise.all(files.map((file, idx) => uploadServicePhoto(`${userId}/${serviceId}/ia`, file, idx)));
      const { data, error: invokeError } = await supabase.functions.invoke('quote-from-photo', { body: { service_id: serviceId, paths } });
      if (invokeError) {
        let message = 'No pudimos usar la IA en este momento. Intenta de nuevo.';
        try {
          const body = await (invokeError as { context?: Response }).context?.json();
          if (body?.error) message = String(body.error);
        } catch {
          // sin cuerpo legible
        }
        throw new Error(message);
      }
      setResult(data as AiResult);
      setSkipActivities(new Set());
      setSkipMaterials(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos usar la IA en este momento.');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggle = (set: Set<number>, idx: number) => {
    const next = new Set(set);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    return next;
  };

  const pickedActivities = result ? result.activities.filter((_, i) => !skipActivities.has(i)) : [];
  const pickedMaterials = result ? result.materials.filter((_, i) => !skipMaterials.has(i)) : [];
  const pickedCount = pickedActivities.length + pickedMaterials.length;

  const apply = () => {
    if (!result) return;
    onApply({ activities: pickedActivities, materials: pickedMaterials, estimatedDays: result.estimated_days });
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={22} color={colors.primary} />
          <Text style={styles.title}>Armar con IA</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={close} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <ErrorBanner seq={errorSeq} message={error} />

          {!result ? (
            <>
              <Text style={styles.help}>
                Tómale foto a tu cotización o lista escrita (a mano, impresa o un pantallazo) o al lugar del trabajo. La IA te propone las
                actividades y los materiales; tú eliges qué agregar y lo revisas antes de enviar.
              </Text>
              <View style={styles.thumbs}>
                {files.map((file, idx) => (
                  <View key={file.uri} style={styles.thumb}>
                    <Image source={{ uri: file.uri }} style={styles.thumbImage} accessibilityLabel={`Foto ${idx + 1}`} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar foto ${idx + 1}`}
                      onPress={() => setFiles((prev) => prev.filter((f) => f.uri !== file.uri))}
                      style={styles.thumbRemove}
                      disabled={analyzing}>
                      <Ionicons name="close-circle" size={22} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
                {preparing ? <ActivityIndicator color={colors.primary} /> : null}
              </View>
              {files.length < MAX_PHOTOS ? (
                <View style={styles.row}>
                  <Button title="Tomar foto" variant="outline" size="sm" onPress={() => addPhotos('camera')} disabled={analyzing || preparing} style={styles.flex} />
                  <Button title="Elegir de la galería" variant="outline" size="sm" onPress={() => addPhotos('gallery')} disabled={analyzing || preparing} style={styles.flex} />
                </View>
              ) : null}
              <Text style={styles.hint}>Hasta {MAX_PHOTOS} fotos por intento, bien iluminadas y con el texto completo a la vista.</Text>
              {analyzing ? (
                <View style={styles.analyzing}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.help}>La IA está leyendo tus fotos… puede tardar hasta un minuto.</Text>
                </View>
              ) : (
                <Button title={files.length ? `Leer ${files.length === 1 ? 'la foto' : `las ${files.length} fotos`} con IA` : 'Agrega una foto'} onPress={analyze} disabled={!files.length || preparing} />
              )}
            </>
          ) : (
            <>
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>{KIND_LABEL[result.kind]}</Text>
                <Text style={styles.help}>{result.summary}</Text>
                {result.estimated_days ? (
                  <Text style={styles.hint}>
                    Duración sugerida: {result.estimated_days} {result.estimated_days === 1 ? 'día hábil' : 'días hábiles'}.
                  </Text>
                ) : null}
              </View>
              {result.warnings.map((w) => (
                <InfoBanner key={w} tone="warning" message={w} />
              ))}

              {result.activities.length ? <Text style={styles.listTitle}>Actividades ({result.activities.length})</Text> : null}
              {result.activities.map((a, idx) => (
                <View key={`a${idx}`} style={[styles.line, skipActivities.has(idx) && styles.lineOff]}>
                  <Checkbox checked={!skipActivities.has(idx)} onChange={() => setSkipActivities((s) => toggle(s, idx))} label={a.description} />
                  <Text style={styles.lineDetail}>
                    {[measureText(a), `${quantityToInput(a.quantity)} ${a.unit}`, a.unit_price ? `${formatCOP(a.unit_price)} c/u` : 'Sin precio: lo pones tú']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {a.needs_review ? (
                    <View style={styles.review}>
                      <Badge label="Revisar" tone="amber" />
                      {a.note ? <Text style={styles.reviewNote}>{a.note}</Text> : null}
                    </View>
                  ) : null}
                </View>
              ))}

              {result.materials.length ? <Text style={styles.listTitle}>Materiales ({result.materials.length})</Text> : null}
              {result.materials.map((m, idx) => (
                <View key={`m${idx}`} style={[styles.line, skipMaterials.has(idx) && styles.lineOff]}>
                  <Checkbox checked={!skipMaterials.has(idx)} onChange={() => setSkipMaterials((s) => toggle(s, idx))} label={m.name} />
                  <Text style={styles.lineDetail}>
                    {`${quantityToInput(m.quantity)} ${m.unit}`} · {m.estimated_cost ? `${formatCOP(m.estimated_cost)} c/u` : 'Sin costo: lo pones tú'}
                  </Text>
                  {m.needs_review ? (
                    <View style={styles.review}>
                      <Badge label="Revisar" tone="amber" />
                      {m.note ? <Text style={styles.reviewNote}>{m.note}</Text> : null}
                    </View>
                  ) : null}
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {result ? (
          <View style={styles.footer}>
            <Button title="Probar con otras fotos" variant="ghost" size="sm" onPress={reset} />
            <Button title={pickedCount ? `Agregar a mi cotización (${pickedCount})` : 'Nada para agregar'} onPress={apply} disabled={!pickedCount} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  body: { padding: spacing.md, gap: spacing.md, maxWidth: 720, width: '100%', alignSelf: 'center' },
  help: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  thumb: { width: 96, height: 96, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.border },
  thumbImage: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 2, right: 2, backgroundColor: colors.surface, borderRadius: 12 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  analyzing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radius },
  summary: { gap: 4, padding: spacing.md, borderRadius: radius, backgroundColor: colors.primarySoft },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  listTitle: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  line: { gap: 4, padding: spacing.sm, borderRadius: radius, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  lineOff: { opacity: 0.5 },
  lineDetail: { fontSize: 13, color: colors.textMuted, paddingLeft: 32 },
  review: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingLeft: 32, flexWrap: 'wrap' },
  reviewNote: { flex: 1, fontSize: 12, color: colors.textMuted },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
