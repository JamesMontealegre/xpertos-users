import { Ionicons } from '@expo/vector-icons';
import { router, Stack, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors, spacing } from '@/constants/theme';

/**
 * Flecha de volver en el encabezado cuando no hay historial (enlace directo o recarga en la web): sin
 * esto el encabezado no muestra flecha y no hay cómo salir. Lleva a `href`.
 */
export function BackFallback({ href, label = 'Volver' }: { href: Href; label?: string }) {
  if (router.canGoBack()) return null;
  return (
    <Stack.Screen
      options={{
        headerLeft: () => (
          <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => router.replace(href)} hitSlop={8} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
        ),
      }}
    />
  );
}

const styles = StyleSheet.create({
  back: { paddingHorizontal: spacing.sm },
});
