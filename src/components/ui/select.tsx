import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  /** Etiqueta corta junto al texto de la opción, p. ej. "Requerido". */
  badge?: string;
};

type BaseProps<T extends string> = {
  label?: string;
  placeholder?: string;
  options: SelectOption<T>[];
  error?: string | null;
  disabled?: boolean;
};

type SingleProps<T extends string> = BaseProps<T> & {
  multiple?: false;
  value: T | null;
  onChange: (value: T) => void;
};

type MultiProps<T extends string> = BaseProps<T> & {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
};

export function Select<T extends string>(props: SingleProps<T> | MultiProps<T>) {
  const { label, placeholder = 'Selecciona…', options, error, disabled } = props;
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // En pantallas anchas (web/tablet) se muestra como diálogo centrado; en el móvil, como hoja inferior.
  const centered = width >= 640;

  const selectedLabels = props.multiple
    ? options.filter((o) => props.value.includes(o.value)).map((o) => o.label)
    : options.filter((o) => o.value === props.value).map((o) => o.label);

  const isSelected = (value: T) => (props.multiple ? props.value.includes(value) : props.value === value);

  const toggle = (value: T) => {
    if (props.multiple) {
      const next = props.value.includes(value) ? props.value.filter((v) => v !== value) : [...props.value, value];
      props.onChange(next);
    } else {
      props.onChange(value);
      setOpen(false);
    }
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, error ? styles.triggerError : null, disabled && styles.disabled]}>
        <Text style={[styles.triggerText, selectedLabels.length === 0 && styles.placeholder]} numberOfLines={2}>
          {selectedLabels.length ? selectedLabels.join(', ') : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, centered && styles.backdropCentered]} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              centered ? styles.sheetCentered : { paddingBottom: Math.max(insets.bottom, spacing.md) },
            ]}
            onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label ?? 'Selecciona'}</Text>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              renderItem={({ item }) => {
                const selected = isSelected(item.value);
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => toggle(item.value)}
                    style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
                    <View style={styles.optionText}>
                      <View style={styles.optionLabelRow}>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{item.label}</Text>
                        {item.badge ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                      {item.description ? <Text style={styles.optionDescription}>{item.description}</Text> : null}
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                  </Pressable>
                );
              }}
            />
            {props.multiple ? (
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.doneButton}>
                <Text style={styles.doneText}>Listo</Text>
              </Pressable>
            ) : null}
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
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  triggerError: { borderColor: colors.danger },
  disabled: { opacity: 0.6 },
  triggerText: { flex: 1, fontSize: 16, color: colors.text },
  placeholder: { color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdropCentered: { justifyContent: 'center', padding: spacing.lg },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
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
  list: { flexGrow: 0, flexShrink: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.sm,
  },
  optionSelected: { backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.8 },
  optionText: { flex: 1, gap: 2 },
  optionLabelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  optionLabel: { fontSize: 16, color: colors.text },
  badge: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#C2410C' },
  optionLabelSelected: { fontWeight: '700', color: colors.primary },
  optionDescription: { fontSize: 13, color: colors.textMuted },
  doneButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
