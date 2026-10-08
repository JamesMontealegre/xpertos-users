import { Tabs } from 'expo-router/js-tabs';

import { TabIcon, tabBarOptions } from '@/components/tab-icon';
import { useRoleGuard } from '@/hooks/use-role-guard';

// Sin index en este grupo: las rutas deben ser únicas entre grupos.
export const unstable_settings = { initialRouteName: 'application' };

/** Panel del aspirante a experto: solo postulación y perfil, sin solicitar servicios. */
export default function ApplicantLayout() {
  const guard = useRoleGuard(['client', 'admin'], { applicant: true });
  if (guard) return guard;

  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen
        name="application"
        options={{
          title: 'Mi postulación',
          tabBarIcon: ({ color }) => <TabIcon name="construct-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <TabIcon name="person-circle-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
