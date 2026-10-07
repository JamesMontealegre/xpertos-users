import { Tabs } from 'expo-router/js-tabs';

import { TabIcon, tabBarOptions } from '@/components/tab-icon';
import { useRoleGuard } from '@/hooks/use-role-guard';

export default function ClientLayout() {
  const guard = useRoleGuard(['client']);
  if (guard) return guard;

  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mis servicios',
          tabBarIcon: ({ color }) => <TabIcon name="list-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: 'Nuevo',
          tabBarIcon: ({ color }) => <TabIcon name="add-circle-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="apply"
        options={{
          title: 'Ser experto',
          tabBarIcon: ({ color }) => <TabIcon name="construct-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <TabIcon name="person-circle-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
