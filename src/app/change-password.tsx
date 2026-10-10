import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Brand } from '@/components/brand';
import { RedirectOnce } from '@/components/redirect-once';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, Loading, Screen, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import { homeFor } from '@/lib/home';
import { mustChangePassword } from '@/lib/session';
import { supabase, translateAuthError } from '@/lib/supabase';
import { confirmPasswordError, passwordError } from '@/lib/validation';
import { useAuth } from '@/providers/auth';
import { useFeedback } from '@/providers/feedback';

/**
 * Primer ingreso con clave temporal (cuentas creadas al postularse desde la landing): antes de seguir,
 * el usuario crea su propia contraseña. Los guardias de ruta envían aquí mientras falte.
 */
export default function ChangePasswordScreen() {
  const { session, profile, isApplicant, loading, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError, errorSeq] = useErrorState();
  const [saving, setSaving] = useState(false);
  const { toast } = useFeedback();

  if (loading) return <Loading />;
  if (!session) return <RedirectOnce href="/(auth)/login" />;
  if (!mustChangePassword(session)) {
    return profile ? <RedirectOnce href={homeFor(profile, isApplicant)} /> : <Loading message="Preparando tu perfil…" />;
  }

  const save = async () => {
    setError(null);
    // Mismas reglas que el registro.
    const invalid = passwordError(password) ?? confirmPasswordError(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    setSaving(false);
    if (updateError) return setError(translateAuthError(updateError.message));
    toast('Contraseña creada. Ya puedes usar la app.', 'success');
    // Al actualizarse la sesión, esta pantalla redirige al inicio.
  };

  return (
    <Screen>
      <View style={styles.wrapper}>
        <Brand />
        <Card style={styles.card}>
          <Text style={styles.title}>Crea tu contraseña</Text>
          <Text style={styles.help}>
            Entraste con una clave temporal. Crea tu propia contraseña para continuar; desde ese momento la clave temporal deja
            de servir.
          </Text>
          <ErrorBanner seq={errorSeq} message={error} />
          <Input
            label="Nueva contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="Mínimo 8 caracteres, con letras y números"
          />
          <Input
            label="Confirma la contraseña"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={save}
          />
          <Button title="Guardar y continuar" onPress={save} loading={saving} />
        </Card>
        <Button title="Cerrar sesión" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  card: { gap: spacing.md, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  help: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
