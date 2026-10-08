import { createContext, useContext, type ComponentProps } from 'react';
import { StyleSheet, Text as RNText, type TextStyle } from 'react-native';

import { fonts } from '@/constants/theme';

const FAMILY_BY_WEIGHT: Record<string, string> = {
  '100': fonts.regular,
  '200': fonts.regular,
  '300': fonts.regular,
  '400': fonts.regular,
  normal: fonts.regular,
  '500': fonts.medium,
  '600': fonts.semibold,
  '700': fonts.bold,
  bold: fonts.bold,
  '800': fonts.extrabold,
  '900': fonts.black,
};

/** Indica si el texto está anidado dentro de otro `Text` (entonces hereda la fuente del padre). */
const InsideText = createContext(false);

/**
 * Traduce `fontWeight`/`fontStyle` a la familia de Mulish correspondiente. El peso se deja en
 * "normal" porque cada familia ya trae su grosor (si no, el navegador le aplica negrita sintética).
 */
export function mulishFor(style: TextStyle | undefined, nested = false): TextStyle | null {
  if (style?.fontFamily) return null;
  const weight = style?.fontWeight != null ? String(style.fontWeight) : undefined;
  const italic = style?.fontStyle === 'italic';
  if (nested && weight === undefined && !italic) return null;

  const family = FAMILY_BY_WEIGHT[weight ?? '400'] ?? fonts.regular;
  if (italic && family === fonts.regular) {
    return { fontFamily: fonts.italic, fontWeight: 'normal', fontStyle: 'normal' };
  }
  return { fontFamily: family, fontWeight: 'normal' };
}

/** `Text` de React Native con la fuente de la marca (Mulish). */
export function Text({ style, children, ...rest }: ComponentProps<typeof RNText>) {
  const nested = useContext(InsideText);
  const font = mulishFor(StyleSheet.flatten(style), nested);
  return (
    <RNText style={font ? [style, font] : style} {...rest}>
      {nested ? children : <InsideText.Provider value>{children}</InsideText.Provider>}
    </RNText>
  );
}
