import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums } from '@/lib/database.types';
import { lifecycleIndex, lifecycleSteps } from '@/lib/labels';

type Props = {
  status: Enums<'service_status'>;
  /** Paso en el que se canceló (para marcarlo en rojo). */
  cancelledFrom?: Enums<'service_status'> | null;
};

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

  return (
    <View style={styles.container} accessibilityLabel={`Avance del servicio: ${cancelled ? 'Cancelado' : stepLabel(current)}`}>
      <View style={styles.track}>
        {lifecycleSteps.map((step, idx) => {
          const done = !cancelled && idx < current;
          const isCurrent = idx === current;
          const dotColor = isCurrent ? currentColor : done ? colors.primary : colors.surface;
          const borderColor = isCurrent ? currentColor : done ? colors.primary : colors.border;
          return (
            <View key={step.key} style={styles.stepCol}>
              <View style={styles.dotRow}>
                <View style={[styles.line, idx === 0 && styles.lineHidden, (done || isCurrent) && !cancelled && styles.lineDone]} />
                <View
                  style={[
                    styles.dot,
                    isCurrent && styles.dotCurrent,
                    { backgroundColor: dotColor, borderColor },
                    isCurrent && { shadowColor: currentColor },
                  ]}>
                  {done ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : isCurrent && cancelled ? (
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  ) : isCurrent && paused ? (
                    <Ionicons name="pause" size={12} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.dotText, isCurrent && styles.dotTextCurrent]}>{idx + 1}</Text>
                  )}
                </View>
                <View
                  style={[
                    styles.line,
                    idx === lifecycleSteps.length - 1 && styles.lineHidden,
                    done && !cancelled && styles.lineDone,
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
                  {idx + 1}. {step.key === 'running' ? (paused ? 'En pausa' : 'En ejecución / En pausa') : step.label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const DOT = 24;

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  track: { flexDirection: 'row', alignItems: 'flex-start' },
  stepCol: { flex: 1, alignItems: 'center', gap: 4 },
  dotRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 3, backgroundColor: colors.border },
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
  dotCurrent: {
    width: DOT + 6,
    height: DOT + 6,
    borderRadius: (DOT + 6) / 2,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  dotText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
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
