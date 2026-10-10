import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';

type Props = {
  title: string;
  /** Una línea de contexto bajo el título (p. ej. el valor o el estado), visible aunque esté plegada. */
  subtitle?: string | null;
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** A la derecha del título (p. ej. un Badge con el estado). */
  right?: ReactNode;
  open: boolean;
  onToggle: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Título más grande: la sección principal del servicio. */
  primary?: boolean;
  children: ReactNode;
};

/** Sección plegable: el encabezado resume la sección y al tocarlo se abre o se cierra. */
export function Collapsible({ title, subtitle, icon, right, open, onToggle, onLayout, primary, children }: Props) {
  return (
    <View style={styles.card} onLayout={onLayout}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        {icon ? (
          <View style={styles.icon}>
            <Ionicons name={icon} size={18} color={colors.primary} />
          </View>
        ) : null}
        <View style={styles.titleWrap}>
          <Text style={[styles.title, primary && styles.titlePrimary]}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  pressed: { backgroundColor: colors.background },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  titlePrimary: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 13, color: colors.textMuted },
  body: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
