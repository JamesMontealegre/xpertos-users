import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { LOGO_RATIO, LOGO_WORDMARK_RATIO, LOGO_WORDMARK_XML, LOGO_XML } from '@/lib/brand-logo';

/**
 * Las dos versiones del logo de Xpertos:
 * - `full`: logo completo con la casa y el lema "servicios a tu medida".
 * - `wordmark`: solo XPERTOS, para encabezados.
 */
const VARIANTS = {
  full: { xml: LOGO_XML, ratio: LOGO_RATIO, label: 'Xpertos, servicios a tu medida' },
  wordmark: { xml: LOGO_WORDMARK_XML, ratio: LOGO_WORDMARK_RATIO, label: 'Xpertos' },
} as const;

export function Logo({
  variant = 'full',
  width,
  style,
}: {
  variant?: keyof typeof VARIANTS;
  width: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const height = Math.round(width / v.ratio);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={v.label} style={[{ width, height }, style]}>
      <SvgXml xml={v.xml} width={width} height={height} />
    </View>
  );
}
