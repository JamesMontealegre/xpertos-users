import { useId, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { LOGO_ICON_XML, LOGO_RATIO, LOGO_WORDMARK_RATIO, LOGO_WORDMARK_XML, LOGO_XML } from '@/lib/brand-logo';

/**
 * Las dos versiones del logo de Xpertos:
 * - `full`: logo completo con la casa y el lema "servicios a tu medida".
 * - `wordmark`: solo XPERTOS, para encabezados.
 * - `icon`: solo la X (loader).
 */
const VARIANTS = {
  full: { xml: LOGO_XML, ratio: LOGO_RATIO, label: 'Xpertos, servicios a tu medida' },
  wordmark: { xml: LOGO_WORDMARK_XML, ratio: LOGO_WORDMARK_RATIO, label: 'Xpertos' },
  icon: { xml: LOGO_ICON_XML, ratio: 1, label: 'Xpertos' },
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
  // Cada logo lleva sus propios ids de degradado. Si dos pantallas montadas tienen el logo (la
  // anterior queda oculta en la pila), en web url(#id) toma el primero, el oculto, y no se pinta.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const xml = useMemo(
    () => v.xml.replace(/id="([^"]+)"/g, `id="${uid}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${uid}-$1)`),
    [v.xml, uid]
  );
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={v.label} style={[{ width, height }, style]}>
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
}
