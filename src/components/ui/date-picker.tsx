import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import { capitalizeFirst, formatPlainDate, todayCO } from '@/lib/format';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

type Props = {
  label?: string;
  placeholder?: string;
  /** Fecha elegida en formato YYYY-MM-DD ('' si no hay). */
  value: string;
  onChange: (value: string) => void;
  /** Primera fecha que se puede elegir (YYYY-MM-DD). */
  minDate?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Campo de fecha que abre un calendario del mes: se toca el día en lugar de escribir la fecha. */
export function DatePicker({ label, placeholder = 'Elige el día', value, onChange, minDate, error, containerStyle }: Props) {
  const [open, setOpen] = useState(false);
  const today = todayCO();
  const start = value || minDate || today;
  const [month, setMonth] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const centered = width >= 640;

  const openPicker = () => {
    const base = value || minDate || start;
    setMonth({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
    setOpen(true);
  };

  const first = new Date(month.y, month.m, 1);
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  // Semana empieza el lunes.
  const leading = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(month.y, month.m, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const title = capitalizeFirst(first.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }));
  const canGoBack = !minDate || iso(month.y, month.m, 1) > minDate.slice(0, 8) + '01';

  const shift = (delta: number) =>
    setMonth(({ y, m }) => {
      const next = new Date(y, m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${value ? formatPlainDate(value) : placeholder}` : undefined}
        onPress={openPicker}
        style={[styles.trigger, error ? styles.triggerError : null]}>
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text style={[styles.triggerText, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatPlainDate(value) : placeholder}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, centered && styles.backdropCentered]} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, centered ? styles.sheetCentered : { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
            onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label ?? 'Elige el día'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.body}>
              <View style={styles.monthRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mes anterior"
                  disabled={!canGoBack}
                  onPress={() => shift(-1)}
                  hitSlop={8}
                  style={[styles.navButton, !canGoBack && styles.disabled]}>
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.monthTitle}>{title}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mes siguiente"
                  onPress={() => shift(1)}
                  hitSlop={8}
                  style={styles.navButton}>
                  <Ionicons name="chevron-forward" size={22} color={colors.text} />
                </Pressable>
              </View>
              <View style={styles.grid}>
                {WEEKDAYS.map((d, i) => (
                  <Text key={`wd-${i}`} style={styles.weekday}>
                    {d}
                  </Text>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <View key={`empty-${i}`} style={styles.cell} />;
                  const disabled = Boolean(minDate && day < minDate);
                  const selected = day === value;
                  const isToday = day === today;
                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="button"
                      accessibilityLabel={formatPlainDate(day)}
                      accessibilityState={{ disabled, selected }}
                      disabled={disabled}
                      onPress={() => {
                        onChange(day);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
                      <View style={[styles.dayCircle, isToday && styles.today, selected && styles.selected]}>
                        <Text style={[styles.dayText, disabled && styles.dayDisabled, selected && styles.dayTextSelected]}>
                          {Number(day.slice(8, 10))}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  trigger: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  triggerError: { borderColor: colors.danger },
  triggerText: { flex: 1, fontSize: 16, color: colors.text },
  placeholder: { color: colors.placeholder },
  error: { color: colors.danger, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  backdropCentered: { justifyContent: 'center', padding: spacing.lg },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetCentered: { borderRadius: 20, paddingBottom: spacing.sm },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { padding: spacing.md, gap: spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  navButton: { padding: 4 },
  disabled: { opacity: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.textMuted, paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: colors.primary },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: 16, color: colors.text },
  dayDisabled: { color: colors.placeholder },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '700' },
});
