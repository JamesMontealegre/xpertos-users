import { Tabs } from 'expo-router/js-tabs';

import { TabIcon, useTabBarOptions } from '@/components/tab-icon';
import { useRoleGuard } from '@/hooks/use-role-guard';

// Sin index en este grupo: la pestaña inicial es "assigned" (las rutas deben ser únicas entre grupos).
export const unstable_settings = { initialRouteName: 'assigned' };

export default function ExpertLayout() {
  const guard = useRoleGuard(['expert', 'admin']);
  const tabBarOptions = useTabBarOptions();
  if (guard) return guard;

  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen
        name="assigned"
        options={{
          title: 'Asignados',
          tabBarIcon: ({ color }) => <TabIcon name="briefcase-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          title: 'Disponibilidad',
          tabBarIcon: ({ color }) => <TabIcon name="calendar-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <TabIcon name="person-circle-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
