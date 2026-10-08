import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { LOGO_HORIZONTAL_RATIO, LOGO_HORIZONTAL_XML, LOGO_MARK_XML, LOGO_RATIO, LOGO_XML } from '@/lib/brand-logo';

const VARIANTS = {
  /** Logo completo con el lema "servicios a tu medida". */
  full: { xml: LOGO_XML, ratio: LOGO_RATIO, label: 'Xpertos, servicios a tu medida' },
  /** Casa + XPERTOS, para encabezados. */
  horizontal: { xml: LOGO_HORIZONTAL_XML, ratio: LOGO_HORIZONTAL_RATIO, label: 'Xpertos' },
  /** Solo la casa. */
  mark: { xml: LOGO_MARK_XML, ratio: 1, label: 'Xpertos' },
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
