import '@/global.css';

export const colors = {
  primary: '#0F766E',
  primaryHover: '#115E59',
  primarySoft: '#CCFBF1',
  accent: '#F97316',
  accentSoft: '#FFEDD5',
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
