import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/logo';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';

const SIZE = 80;
const ICON = 44;
const useNativeDriver = Platform.OS !== 'web';

/**
 * Loader de Xpertos (el mismo del panel de operación): la X late dentro de un anillo azul y naranja
 * que gira. Con "reducir movimiento" activado en el sistema, se queda quieto.
 */
export function XLoader({ message = 'Cargando…' }: { message?: string | null }) {
  const [spin] = useState(() => new Animated.Value(0));
  const [beat] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let cancelled = false;
    let loops: Animated.CompositeAnimation[] = [];
    const step = (toValue: number, duration: number) => Animated.timing(beat, { toValue, duration, useNativeDriver });
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled || reduce) return;
        loops = [
          Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver })),
          // Mismo ritmo que la palpitación del paso activo en el panel (1,8 s).
          Animated.loop(Animated.sequence([step(1.08, 270), step(1, 270), step(1.05, 270), step(1, 990)])),
        ];
        loops.forEach((loop) => loop.start());
      });
    return () => {
      cancelled = true;
      loops.forEach((loop) => loop.stop());
    };
  }, [spin, beat]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Cargando'}
      accessibilityLiveRegion="polite">
      <View style={styles.box}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
        <Animated.View style={[styles.icon, { transform: [{ scale: beat }] }]}>
          <Logo variant="icon" width={ICON} />
        </Animated.View>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm },
  box: { width: SIZE, height: SIZE },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 4,
    borderColor: 'rgba(10, 75, 175, 0.15)',
    borderTopColor: colors.primary,
    borderRightColor: colors.accent,
  },
  icon: { position: 'absolute', top: (SIZE - ICON) / 2, left: (SIZE - ICON) / 2 },
  message: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
});
