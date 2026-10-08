import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'sm';
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style, size = 'md' }: Props) {
  const isDisabled = disabled || loading;
  const palette = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.small,
        { backgroundColor: pressed ? palette.pressed : palette.bg, borderColor: palette.border },
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.label, size === 'sm' && styles.labelSmall, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; pressed: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryHover, fg: '#FFFFFF', border: colors.primary },
  secondary: { bg: colors.accent, pressed: colors.accentHover, fg: '#FFFFFF', border: colors.accent },
  outline: { bg: colors.surface, pressed: colors.background, fg: colors.primary, border: colors.primary },
  danger: { bg: colors.surface, pressed: colors.dangerSoft, fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', pressed: colors.slateSoft, fg: colors.text, border: 'transparent' },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  labelSmall: {
    fontSize: 14,
  },
});
