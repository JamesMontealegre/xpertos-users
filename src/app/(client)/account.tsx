import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/ui/screen';

export default function ClientProfileScreen() {
  return (
    <Screen title="Mi perfil" subtitle="Tus datos de contacto" withTabs>
      <ProfileForm />
    </Screen>
  );
}
