import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';

type CardProps = ViewProps & {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Contenedor de una sección: tarjeta normal o, dentro de una sección plegable (`plain`), solo el contenido
 * sin marco para no anidar tarjetas.
 */
export function SectionBody({ plain, style, children }: { plain?: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return plain ? <View style={[styles.plain, style]}>{children}</View> : <Card style={style}>{children}</Card>;
}

export function Card({ children, style, onPress, ...rest }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function KeyValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  plain: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  kv: {
    gap: 2,
  },
  kvLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kvValue: {
    fontSize: 15,
    color: colors.text,
  },
});
