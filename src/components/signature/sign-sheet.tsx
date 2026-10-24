import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { Logo } from '@/components/logo';
import { exportSignature, inkLength, SignaturePad, type Point, type SignatureData, type Stroke } from '@/components/signature/signature-pad';
import { Button } from '@/components/ui/button';
import { ErrorBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  /** Título del contrato y su enunciado (partes, servicio y actividades). */
  title: string;
  statement: string | null;
  signerName: string | null;
  confirmLabel?: string;
  onCancel: () => void;
  /** Devuelve un mensaje de error para mostrar en la hoja, o nada si firmó. */
  onConfirm: (signature: SignatureData) => Promise<string | null | void>;
};

const MIN_INK = 60; // px de trazo para aceptar una firma (descarta un toque o una raya mínima)

/**
 * Hoja de firma a pantalla completa y en horizontal: logo, título, enunciado y el recuadro para firmar. En un
 * teléfono vertical el contenido se gira 90° para firmar a lo ancho, sin depender del giro automático del equipo
 * (que una página web no puede forzar). Si la pantalla ya está horizontal, se muestra tal cual.
 */
export function SignSheet({ visible, title, statement, signerName, confirmLabel = 'Confirmar firma', onCancel, onConfirm }: Props) {
  const { width, height } = useWindowDimensions();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [padOffset, setPadOffset] = useState<Point>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError, errorSeq] = useErrorState();

  const rotate = height > width;
  const frameW = rotate ? height : width;
  const frameH = rotate ? width : height;
  // Marco girado: mide alto × ancho de la ventana y se gira sobre su centro para cubrirla.
  const frame: ViewStyle = rotate
    ? { position: 'absolute', width: frameW, height: frameH, left: (width - height) / 2, top: (height - width) / 2, transform: [{ rotate: '90deg' }] }
    : { flex: 1 };
  const compact = frameH < 420;
  const hasInk = inkLength(strokes) >= MIN_INK;

  const close = () => {
    if (saving) return;
    setStrokes([]);
    setError(null);
    onCancel();
  };

  const confirm = async () => {
    setError(null);
    const signature = hasInk ? exportSignature(strokes) : null;
    if (!signature) return setError('Dibuja tu firma completa en el recuadro.');
    setSaving(true);
    try {
      const message = await onConfirm(signature);
      if (message) setError(message);
      else setStrokes([]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={close} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.backdrop}>
        <View style={[styles.frame, frame, !rotate && styles.frameWide, compact && styles.frameCompact]}>
          <View style={styles.header}>
            <Logo variant="wordmark" width={compact ? 96 : 120} />
            <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sin firmar" onPress={close} hitSlop={12} style={styles.close}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {statement ? (
            <ScrollView style={[styles.statement, compact && styles.statementCompact]} nestedScrollEnabled>
              <Text style={styles.statementText}>{statement}</Text>
            </ScrollView>
          ) : null}

          <SignaturePad
            strokes={strokes}
            onChange={setStrokes}
            rotated={rotate ? { windowWidth: width, offset: padOffset } : null}
            style={styles.pad}
            onLayout={(event) => setPadOffset({ x: event.nativeEvent.layout.x, y: event.nativeEvent.layout.y })}
          />

          <View style={styles.footer}>
            <View style={styles.signer}>
              <Text style={styles.signerName} numberOfLines={1}>
                {signerName ?? 'Firma del Cliente'}
              </Text>
              <Text style={styles.signerHint} numberOfLines={1}>
                Firma dentro del recuadro con el dedo{Platform.OS === 'web' ? ' o el ratón' : ''}
              </Text>
            </View>
            <Button title="Limpiar" variant="ghost" size="sm" onPress={() => setStrokes([])} disabled={saving || strokes.length === 0} />
            <Button title={confirmLabel} size="sm" onPress={confirm} loading={saving} disabled={!hasInk} />
          </View>
          <ErrorBanner seq={errorSeq} message={error} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  frame: { backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  frameWide: { width: '100%', maxWidth: 980, maxHeight: 680, borderRadius: radius },
  frameCompact: { padding: spacing.sm, gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  titleCompact: { fontSize: 15 },
  close: { padding: 4 },
  statement: { maxHeight: 96, flexGrow: 0 },
  statementCompact: { maxHeight: 54 },
  statementText: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  pad: {
    flex: 1,
    minHeight: 120,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius,
    backgroundColor: colors.primarySoft,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  signer: { flex: 1, gap: 2 },
  signerName: { fontSize: 14, fontWeight: '700', color: colors.text },
  signerHint: { fontSize: 12, color: colors.textMuted },
});
