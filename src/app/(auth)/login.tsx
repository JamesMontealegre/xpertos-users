import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, Screen } from '@/components/ui/screen';
import { colors, spacing } from '@/constants/theme';
import { supabase, translateAuthError } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (authError) {
      setError(translateAuthError(authError.message));
      return;
    }
    // La redirección la hace el layout raíz al detectar la sesión.
  };

  return (
    <Screen>
      <View style={styles.wrapper}>
        <Brand />
        <Card style={styles.card}>
          <Text style={styles.title}>Ingresar</Text>
          <ErrorBanner message={error} />
          <Input
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="tu@correo.com"
          />
          <Input
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            placeholder="••••••••"
            onSubmitEditing={submit}
          />
          <Button title="Ingresar" onPress={submit} loading={loading} />
          <Text style={styles.footer}>
            ¿Aún no tienes cuenta?{' '}
            <Link href="/(auth)/register" style={styles.link}>
              Regístrate
            </Link>
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  footer: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
  },
});
