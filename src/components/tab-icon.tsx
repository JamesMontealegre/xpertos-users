import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { colors, fonts } from '@/constants/theme';

type Props = {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  size?: number;
};

export function TabIcon({ name, color, size = 22 }: Props) {
  return <Ionicons name={name} size={size} color={color} />;
}

/**
 * Alto de la barra sin el área segura inferior: cada pestaña tiene 5 px de relleno arriba y abajo, el
 * ícono ocupa 28 px y la etiqueta 16 px de interlineado (5 + 28 + 16 + 5 = 54, con margen).
 */
const TAB_BAR_HEIGHT = 60;

/**
 * Opciones de las pantallas con pestañas: encabezado fijo de la app y barra inferior. El alto se fija para que la etiqueta (Mulish 12 px) no se recorte
 * —con el alto por defecto (49 px) en la web le quedaban 10 px— y suma el área segura inferior del
 * teléfono (indicador de inicio del iPhone).
 */
export function useTabBarOptions() {
  const insets = useSafeAreaInsets();
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      height: TAB_BAR_HEIGHT + insets.bottom,
      paddingTop: 0,
      paddingBottom: insets.bottom,
    },
    tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold },
    // Encabezado fijo de la app (logo + notificaciones) en todas las pestañas.
    headerShown: true,
    header: () => <AppHeader />,
  };
}
