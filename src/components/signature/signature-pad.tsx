import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';

export type Point = { x: number; y: number };
export type Stroke = Point[];
export type SignatureData = { path: string; width: number; height: number };

const INK = '#16193A';
const MIN_STEP = 1.2; // distancia mínima entre puntos (px): menos ruido y paths más livianos
const PAD = 8; // margen alrededor del trazo al exportar

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Path SVG de un trazo, suavizado con curvas cuadráticas por los puntos medios. */
function strokePath(points: Stroke, dx = 0, dy = 0): string {
  if (points.length === 0) return '';
  const p = points.map((pt) => ({ x: r1(pt.x + dx), y: r1(pt.y + dy) }));
  if (p.length === 1) return `M ${p[0].x} ${p[0].y} L ${r1(p[0].x + 0.5)} ${p[0].y}`;
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mid = { x: r1((p[i].x + p[i + 1].x) / 2), y: r1((p[i].y + p[i + 1].y) / 2) };
    d += ` Q ${p[i].x} ${p[i].y} ${mid.x} ${mid.y}`;
  }
  const last = p[p.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

/** Largo total del trazo (px), para saber si hay una firma de verdad y no un toque suelto. */
export function inkLength(strokes: Stroke[]): number {
  let total = 0;
  for (const s of strokes) for (let i = 1; i < s.length; i++) total += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
  return total;
}

/** Firma lista para guardar: el path recortado a su contorno (con un margen) y el tamaño de ese lienzo. */
export function exportSignature(strokes: Stroke[]): SignatureData | null {
  const points = strokes.flat();
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));
  return {
    path: strokes.map((s) => strokePath(s, PAD - minX, PAD - minY)).join(' '),
    width: Math.max(20, Math.ceil(maxX - minX + PAD * 2)),
    height: Math.max(20, Math.ceil(maxY - minY + PAD * 2)),
  };
}

/** Panel girado 90° en sentido horario (horizontal forzado en un teléfono vertical). */
export type RotatedFrame = { windowWidth: number; offset: Point };

type Props = {
  strokes: Stroke[];
  onChange: Dispatch<SetStateAction<Stroke[]>>;
  /** Si el panel va dentro de un marco girado: en la web el toque se traduce a mano al sistema del panel. */
  rotated?: RotatedFrame | null;
  style?: ViewStyle;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * Recuadro para firmar con el dedo (celular) o el ratón (computador). El trazo se guarda como puntos y se dibuja
 * con react-native-svg, igual en iOS, Android y web.
 */
export function SignaturePad({ strokes, onChange, rotated, style, onLayout }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drawing = useRef(false);

  const point = (event: GestureResponderEvent): Point => {
    const e = event.nativeEvent;
    // En iOS y Android el toque ya llega en el sistema del panel aunque esté girado. En la web, el navegador lo da
    // en coordenadas de página: con el marco girado 90° horario, (x, y) de la página es (ancho − v, u) del marco.
    if (rotated && Platform.OS === 'web') {
      return { x: e.pageY - rotated.offset.x, y: rotated.windowWidth - e.pageX - rotated.offset.y };
    }
    return { x: e.locationX, y: e.locationY };
  };

  const inside = (p: Point) => p.x >= 0 && p.y >= 0 && p.x <= size.width && p.y <= size.height;

  const start = (event: GestureResponderEvent) => {
    const p = point(event);
    drawing.current = true;
    onChange((prev) => [...prev, [p]]);
  };

  const move = (event: GestureResponderEvent) => {
    if (!drawing.current) return;
    const p = point(event);
    if (!inside(p)) return;
    onChange((prev) => {
      const current = prev[prev.length - 1];
      const last = current?.[current.length - 1];
      if (!current || (last && Math.hypot(p.x - last.x, p.y - last.y) < MIN_STEP)) return prev;
      return [...prev.slice(0, -1), [...current, p]];
    });
  };

  const end = () => {
    drawing.current = false;
  };

  return (
    <View
      style={[styles.pad, Platform.OS === 'web' ? (webNoGestures as ViewStyle) : null, style]}
      onLayout={(event) => {
        setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
        onLayout?.(event);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={start}
      onResponderMove={move}
      onResponderRelease={end}
      onResponderTerminate={end}
      accessibilityLabel="Recuadro para firmar"
      accessibilityHint="Dibuja tu firma con el dedo o el ratón">
      {/* Guía y trazo no reciben toques: así el toque siempre cae en el recuadro y sus coordenadas son las del recuadro. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Text style={styles.guide}>Firma aquí</Text>
        <View style={styles.baseline} />
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {size.width > 0 ? (
          <Svg width={size.width} height={size.height}>
            {strokes.map((stroke, i) => (
              <Path
                key={i}
                d={strokePath(stroke)}
                stroke={INK}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

// En la web, que arrastrar el dedo dibuje en vez de desplazar o seleccionar la página.
const webNoGestures = { touchAction: 'none', userSelect: 'none', cursor: 'crosshair' };

const styles = StyleSheet.create({
  pad: { backgroundColor: colors.surface, overflow: 'hidden' },
  guide: { position: 'absolute', top: spacing.sm, left: spacing.md, fontSize: 12, fontWeight: '700', color: colors.primary, opacity: 0.7 },
  baseline: { position: 'absolute', left: '6%', right: '6%', bottom: '24%', height: 1, backgroundColor: colors.textMuted, opacity: 0.4 },
});
