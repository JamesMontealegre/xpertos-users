import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/logo';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';

/** Logo completo de Xpertos (con el lema) y un texto de contexto opcional. */
export function Brand({ tagline }: { tagline?: string }) {
  return (
    <View style={styles.container}>
      <Logo variant="full" width={230} />
      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tagline: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
