import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { cityError, fullNameError, normalizePhone, phoneError } from '@/lib/validation';
import { APP_VERSION } from '@/lib/version';
import { useAuth } from '@/providers/auth';
import { useFeedback } from '@/providers/feedback';

/** Formulario de datos básicos del perfil + cerrar sesión y eliminar la cuenta. Compartido por cliente, aspirante y experto. */
export function ProfileForm() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const { confirm, toast } = useFeedback();
  const [submitted, setSubmitted] = useState(false);

  // Mismas reglas que el registro; los errores aparecen al intentar guardar.
  const errors = { fullName: fullNameError(fullName), phone: phoneError(phone), city: cityError(city) };
  const hasErrors = Object.values(errors).some(Boolean);

  const save = async () => {
    if (!session) return;
    setError(null);
    setSubmitted(true);
    if (hasErrors) return setError('Revisa los campos marcados.');
    setSaving(true);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim().replace(/\s+/g, ' '), phone: normalizePhone(phone), city: city.trim() })
      .eq('id', session.user.id);
    setSaving(false);
    if (updateError) {
      setError(`No pudimos guardar los cambios: ${updateError.message}`);
      return;
    }
    await refreshProfile();
    toast('Perfil actualizado.', 'success');
  };

  const [deleting, setDeleting] = useState(false);

  // Lo exigen App Store y Google Play: la cuenta se elimina desde la app (Edge Function delete-account).
  const deleteAccount = async () => {
    setError(null);
    const ok = await confirm({
      title: 'Eliminar mi cuenta',
      message:
        'Borraremos tus datos personales y no podrás volver a ingresar. Los contratos y pagos de tus servicios se conservan por obligación legal. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar mi cuenta',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    const { error: invokeError } = await supabase.functions.invoke('delete-account', { body: {} });
    setDeleting(false);
    if (invokeError) {
      let message = 'No pudimos eliminar tu cuenta. Intenta de nuevo.';
      try {
        const body = await (invokeError as { context?: Response }).context?.json();
        if (body?.error) message = String(body.error);
      } catch {
        // sin cuerpo legible
      }
      return setError(message);
    }
    toast('Tu cuenta fue eliminada.', 'success');
    await signOut();
  };

  const confirmSignOut = async () => {
    const ok = await confirm({ title: 'Cerrar sesión', message: 'Para volver a entrar necesitarás tu correo y contraseña.', confirmLabel: 'Cerrar sesión', destructive: true });
    if (ok) await signOut();
  };

  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.email}>{profile?.email ?? session?.user.email}</Text>
        <ErrorBanner seq={errorSeq} message={error} />
        <Input label="Nombre completo" value={fullName} onChangeText={setFullName} error={submitted ? errors.fullName : null} />
        <Input
          label="Celular"
          value={phone}
          onChangeText={(text) => setPhone(text.replace(/[^\d\s+-]/g, ''))}
          keyboardType="phone-pad"
          placeholder="300 123 4567"
          maxLength={16}
          error={submitted ? errors.phone : null}
        />
        <Input label="Ciudad" value={city} onChangeText={setCity} placeholder="Bogotá" error={submitted ? errors.city : null} />
        <Button title="Guardar cambios" onPress={save} loading={saving} />
      </Card>
      {profile?.role === 'admin' && profile.is_super_admin ? (
        <Button title="Cambiar de vista (superadmin)" variant="outline" onPress={() => router.replace('/admin')} />
      ) : null}
      <Button title="Cerrar sesión" variant="danger" onPress={confirmSignOut} />
      {profile?.role !== 'admin' ? (
        <Button title="Eliminar mi cuenta" variant="ghost" onPress={deleteAccount} loading={deleting} />
      ) : null}
      <Text style={styles.version}>Versión {APP_VERSION}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  email: { color: colors.textMuted, fontSize: 14 },
  version: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
