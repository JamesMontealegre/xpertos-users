import '@/global.css';

/** Rampa de la marca alrededor del azul del logo (#0A4BAF = 600). */
export const brand = {
  50: '#EEF4FD',
  100: '#D9E6FB',
  200: '#B6CFF7',
  300: '#86AFF0',
  400: '#4F87E6',
  500: '#2766D6',
  600: '#0A4BAF',
  700: '#083C8F',
  800: '#0A3474',
  900: '#0C2D60',
  950: '#081C3D',
} as const;

export const colors = {
  primary: brand[600],
  primaryHover: brand[700],
  primarySoft: brand[50],
  // Naranja del logo.
  accent: '#F26A00',
  accentHover: '#D45A00',
  accentSoft: '#FFEFE2',
  // Fondo general de la app ("surface" del tema); las tarjetas van en blanco encima.
  background: '#EBEFF2',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#5A6A7E',
  // Texto de ejemplo de los campos: más claro que un valor escrito para no confundirlos.
  placeholder: '#A0AAB6',
  border: '#DBE1E7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  info: '#2563EB',
  infoSoft: '#DBEAFE',
  slate: '#475569',
  slateSoft: '#E2E8F0',
  // Tono de estado "En ejecución" (se mantiene verde azulado para distinguirlo de "Asignado").
  teal: '#0F766E',
  tealSoft: '#CCFBF1',
} as const;

/**
 * Mulish: en nativo cada peso es un archivo distinto, así que el peso se elige por familia
 * (ver `src/components/ui/text.tsx`) y no con `fontWeight`.
 */
export const fonts = {
  regular: 'Mulish_400Regular',
  italic: 'Mulish_400Regular_Italic',
  medium: 'Mulish_500Medium',
  semibold: 'Mulish_600SemiBold',
  bold: 'Mulish_700Bold',
  extrabold: 'Mulish_800ExtraBold',
  black: 'Mulish_900Black',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = 12;
export const maxContentWidth = 720;
