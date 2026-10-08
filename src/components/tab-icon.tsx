import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

import { colors } from '@/constants/theme';

type Props = {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  size?: number;
};

export function TabIcon({ name, color, size = 22 }: Props) {
  return <Ionicons name={name} size={size} color={color} />;
}

export const tabBarOptions = {
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
  tabBarLabelStyle: { fontSize: 12, fontWeight: '600' as const },
  headerShown: false,
};
