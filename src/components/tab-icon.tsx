import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

type Props = {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  size?: number;
};

export function TabIcon({ name, color, size = 22 }: Props) {
  return <Ionicons name={name} size={size} color={color} />;
}

export const tabBarOptions = {
  tabBarActiveTintColor: '#0F766E',
  tabBarInactiveTintColor: '#64748B',
  tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0' },
  tabBarLabelStyle: { fontSize: 12, fontWeight: '600' as const },
  headerShown: false,
};
