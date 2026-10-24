import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Firma manuscrita guardada (path SVG en su lienzo), escalada al ancho dado. */
export function SignaturePreview({ path, width, height, displayWidth = 160 }: { path: string; width: number; height: number; displayWidth?: number }) {
  const displayHeight = Math.min(80, (height / width) * displayWidth);
  return (
    <View accessibilityLabel="Tu firma" style={{ width: displayWidth, height: displayHeight }}>
      <Svg width={displayWidth} height={displayHeight} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <Path d={path} stroke="#16193A" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}
