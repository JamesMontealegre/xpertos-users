import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { colors, maxContentWidth, spacing } from '@/constants/theme';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Sin scroll (p. ej. para listas que ya hacen scroll). */
  plain?: boolean;
  /** Añade espacio inferior para la barra de pestañas. */
  withTabs?: boolean;
  /** Muestra el logo de Xpertos sobre el título (pantallas de inicio de cada rol). */
  brand?: boolean;
};

export function Screen({ children, title, subtitle, refreshing = false, onRefresh, plain, withTabs, brand }: Props) {
  const insets = useSafeAreaInsets();
  const header =
    title || subtitle ? (
      <View style={styles.header}>
        {brand ? <Logo variant="wordmark" width={160} style={styles.brand} /> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    ) : null;

  if (plain) {
    return (
      <View style={[styles.root, { paddingTop: title ? insets.top : 0 }]}>
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
          { paddingTop: title ? insets.top + spacing.md : spacing.md, paddingBottom: withTabs ? 96 : insets.bottom + spacing.xl },
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
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{message}</Text>
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
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  brand: { marginBottom: spacing.sm },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
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
  loadingText: {
    color: colors.textMuted,
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
