import '@/global.css';

export const colors = {
  // Colores del logo: azul (principal) y naranja (acento).
  primary: '#0A4BAF',
  primaryHover: '#083A8C',
  primarySoft: '#E7EFFC',
  accent: '#F26A00',
  accentHover: '#D45A00',
  accentSoft: '#FFEFE2',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
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

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = 12;
export const maxContentWidth = 720;
