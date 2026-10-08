import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, InfoBanner } from '@/components/ui/screen';
import { colors, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

/** Formulario de datos básicos del perfil + cerrar sesión. Compartido por cliente, aspirante y experto. */
export function ProfileForm() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!session) return;
    setError(null);
    setSaved(false);
    if (!fullName.trim()) {
      setError('El nombre no puede estar vacío.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, city: city.trim() || null })
      .eq('id', session.user.id);
    setSaving(false);
    if (updateError) {
      setError(`No pudimos guardar los cambios: ${updateError.message}`);
      return;
    }
    await refreshProfile();
    setSaved(true);
  };

  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.email}>{profile?.email ?? session?.user.email}</Text>
        <ErrorBanner message={error} />
        {saved ? <InfoBanner tone="success" message="Perfil actualizado." /> : null}
        <Input label="Nombre completo" value={fullName} onChangeText={setFullName} />
        <Input label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="300 000 0000" />
        <Input label="Ciudad" value={city} onChangeText={setCity} placeholder="Bogotá" />
        <Button title="Guardar cambios" onPress={save} loading={saving} />
      </Card>
      {profile?.role === 'admin' ? (
        <Button title="Cambiar de vista (super admin)" variant="outline" onPress={() => router.replace('/admin')} />
      ) : null}
      <Button title="Cerrar sesión" variant="danger" onPress={signOut} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  email: { color: colors.textMuted, fontSize: 14 },
});
