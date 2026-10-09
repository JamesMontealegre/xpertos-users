import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums } from '@/lib/database.types';
import { lifecycleIndex, lifecycleSteps } from '@/lib/labels';

type Props = {
  status: Enums<'service_status'>;
  /** Paso en el que se canceló (para marcarlo en rojo). */
  cancelledFrom?: Enums<'service_status'> | null;
};

/** Ciclo de 1.8 s como en el panel (step-pulse / step-beat); se detiene si el usuario pidió reducir el movimiento. */
function useStepAnimation(enabled: boolean) {
  const [progress] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled || reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1800,
        easing: Easing.bezier(0.2, 0.6, 0.4, 1),
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    loop.start();
    return () => {
      loop.stop();
      progress.setValue(0);
    };
  }, [enabled, reduceMotion, progress]);

  return {
    // Onda que se expande y se desvanece detrás del paso actual.
    pulse: {
      opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [reduceMotion ? 0 : 0.55, 0, 0] }),
      transform: [{ scale: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1.75, 1.75] }) }],
    },
    // Latido del círculo del paso actual.
    beat: {
      transform: [{ scale: progress.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 1], outputRange: [1, 1.08, 1, 1.05, 1] }) }],
    },
  };
}

/**
 * Barra de avance del servicio con los 8 pasos. En pantallas anchas muestra el nombre de cada paso;
 * en el móvil muestra los puntos y el paso actual/siguiente, con la lista completa desplegable.
 */
export function LifecycleProgress({ status, cancelledFrom }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 640;
  const [expanded, setExpanded] = useState(false);

  const cancelled = status === 'cancelled';
  const paused = status === 'paused';
  const current = cancelled ? (cancelledFrom ? lifecycleIndex(cancelledFrom) : -1) : lifecycleIndex(status);
  const currentColor = cancelled ? colors.danger : paused ? colors.warning : colors.primary;
  const stepLabel = (idx: number) => (idx === 5 && paused ? 'En pausa' : lifecycleSteps[idx].label);
  const next = !cancelled && current >= 0 && current < lifecycleSteps.length - 1 ? lifecycleSteps[current + 1] : null;
  const animation = useStepAnimation(!cancelled && status !== 'completed' && current >= 0);

  return (
    <View style={styles.container} accessibilityLabel={`Avance del servicio: ${cancelled ? 'Cancelado' : stepLabel(current)}`}>
      <View style={styles.track}>
        {lifecycleSteps.map((step, idx) => {
          const done = !cancelled && idx < current;
          const isCurrent = idx === current;
          // Finalizado: todos los pasos quedan hechos.
          const allDone = status === 'completed';
          const isActive = isCurrent && !allDone;
          const filled = done || allDone || isCurrent;
          const dotColor = isActive ? currentColor : filled ? colors.primary : colors.surface;
          const borderColor = isActive ? currentColor : filled ? colors.primary : colors.border;
          // La línea hacia un paso se pinta si ese paso ya se alcanzó (como en el panel).
          const reached = (i: number) => !cancelled && (i <= current || allDone);
          return (
            <View key={step.key} style={styles.stepCol}>
              {/* Todos los círculos comparten el mismo centro: la línea queda continua. */}
              <View style={styles.dotRow}>
                <View style={[styles.line, idx === 0 && styles.lineHidden, idx > 0 && reached(idx) && styles.lineDone]} />
                <View style={styles.dotSlot}>
                  {isActive && !cancelled ? (
                    <>
                      <Animated.View pointerEvents="none" style={[styles.pulse, { backgroundColor: currentColor }, animation.pulse]} />
                      <View pointerEvents="none" style={[styles.halo, { backgroundColor: currentColor }]} />
                    </>
                  ) : null}
                  <Animated.View
                    style={[styles.dot, { backgroundColor: dotColor, borderColor }, isActive && !cancelled && animation.beat]}>
                    {done || (allDone && idx <= current) ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : isCurrent && cancelled ? (
                      <Ionicons name="close" size={15} color="#FFFFFF" />
                    ) : isCurrent && paused ? (
                      <Ionicons name="pause" size={13} color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.dotText, isCurrent && styles.dotTextCurrent]}>{idx + 1}</Text>
                    )}
                  </Animated.View>
                </View>
                <View
                  style={[
                    styles.line,
                    idx === lifecycleSteps.length - 1 && styles.lineHidden,
                    idx < lifecycleSteps.length - 1 && reached(idx + 1) && styles.lineDone,
                  ]}
                />
              </View>
              {wide ? (
                <Text
                  style={[styles.stepLabel, done && styles.stepLabelDone, isCurrent && { color: currentColor, fontWeight: '800' }]}
                  numberOfLines={2}>
                  {stepLabel(idx)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {cancelled ? (
        <View style={[styles.summary, styles.summaryCancelled]}>
          <Ionicons name="close-circle" size={18} color={colors.danger} />
          <Text style={[styles.summaryText, { color: colors.danger }]}>
            Cancelado{current >= 0 ? ` en el paso ${current + 1}: ${lifecycleSteps[current].label}` : ''}
          </Text>
        </View>
      ) : !wide ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Ocultar pasos' : 'Ver todos los pasos'}
          onPress={() => setExpanded((v) => !v)}
          style={styles.summary}>
          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryText}>
              Paso {current + 1} de {lifecycleSteps.length}: <Text style={{ color: currentColor }}>{stepLabel(current)}</Text>
            </Text>
            {next ? <Text style={styles.nextText}>Sigue: {next.label}</Text> : null}
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {expanded && !wide && !cancelled ? (
        <View style={styles.list}>
          {lifecycleSteps.map((step, idx) => {
            const done = idx < current;
            const isCurrent = idx === current;
            return (
              <View key={step.key} style={styles.listRow}>
                <Ionicons
                  name={done ? 'checkmark-circle' : isCurrent ? (paused ? 'pause-circle' : 'radio-button-on') : 'ellipse-outline'}
                  size={16}
                  color={done ? colors.primary : isCurrent ? currentColor : colors.border}
                />
                <Text style={[styles.listText, done && styles.stepLabelDone, isCurrent && { color: currentColor, fontWeight: '800' }]}>
                  {idx + 1}. {step.key === 'running' && paused ? 'En pausa' : step.label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const DOT = 28;
/** Alto de la fila: el círculo más su halo, para que todos los pasos queden al mismo nivel. */
const SLOT = DOT + 10;

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  track: { flexDirection: 'row', alignItems: 'flex-start' },
  stepCol: { flex: 1, alignItems: 'center', gap: 4 },
  dotRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', height: SLOT },
  // Del ancho del círculo: la línea llega hasta su borde y el halo sobresale por encima de ella.
  dotSlot: { width: DOT, height: SLOT, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  line: { flex: 1, height: 2, backgroundColor: colors.border },
  lineHidden: { backgroundColor: 'transparent' },
  lineDone: { backgroundColor: colors.primary },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Halo fijo (como ring-4 del panel) y onda animada detrás del paso actual.
  halo: { position: 'absolute', width: DOT + 8, height: DOT + 8, borderRadius: (DOT + 8) / 2, opacity: 0.2 },
  pulse: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  dotTextCurrent: { color: '#FFFFFF' },
  stepLabel: { fontSize: 11, lineHeight: 14, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 2 },
  stepLabelDone: { color: colors.text },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  summaryCancelled: { backgroundColor: colors.dangerSoft },
  summaryTextWrap: { flex: 1, gap: 2 },
  summaryText: { fontSize: 14, fontWeight: '700', color: colors.text },
  nextText: { fontSize: 12, color: colors.textMuted },
  list: { gap: 6, paddingHorizontal: spacing.sm },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listText: { fontSize: 13, color: colors.textMuted },
});
