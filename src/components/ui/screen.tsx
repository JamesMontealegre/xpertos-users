import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { XLoader } from '@/components/ui/x-loader';
import { colors, maxContentWidth, spacing } from '@/constants/theme';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Sin scroll (p. ej. para listas que ya hacen scroll). */
  plain?: boolean;
  /**
   * Pantalla con pestañas: va debajo del encabezado fijo de la app (logo y notificaciones), que ya
   * cubre el área segura superior, y deja espacio para la barra inferior.
   */
  withTabs?: boolean;
};

export function Screen({ children, title, subtitle, refreshing = false, onRefresh, plain, withTabs }: Props) {
  const insets = useSafeAreaInsets();
  // Título de la sección (debajo del encabezado de la app en las pantallas con pestañas).
  const header =
    title || subtitle ? (
      <View style={styles.header}>
        {title ? (
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    ) : null;
  // Sin encabezado de la app (p. ej. login), el título baja del área segura superior.
  const topInset = title && !withTabs ? insets.top : 0;

  if (plain) {
    return (
      <View style={[styles.root, { paddingTop: topInset }]}>
        <View style={styles.content}>
          {header}
          {children}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topInset + (withTabs ? spacing.lg : spacing.md), paddingBottom: withTabs ? spacing.xl : insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}>
        <View style={styles.content}>
          {header}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Loading({ message = 'Cargando…' }: { message?: string }) {
  return (
    <View style={styles.loading}>
      <XLoader message={message} />
    </View>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function InfoBanner({ message, tone = 'info' }: { message: string; tone?: 'info' | 'success' | 'warning' }) {
  const palette = {
    info: { bg: colors.infoSoft, fg: colors.info },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
  }[tone];
  return (
    <View style={[styles.infoBanner, { backgroundColor: palette.bg }]}>
      <Text style={[styles.infoText, { color: palette.fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: spacing.md,
  },
  header: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
  },
  infoBanner: {
    borderRadius: 12,
    padding: spacing.md,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
