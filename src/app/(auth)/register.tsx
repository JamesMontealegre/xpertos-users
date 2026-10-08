import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, InfoBanner, Screen } from '@/components/ui/screen';
import { colors, spacing } from '@/constants/theme';
import { supabase, translateAuthError } from '@/lib/supabase';

type AccountType = 'client' | 'expert';

const ACCOUNT_TYPES: { value: AccountType; title: string; description: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'client', title: 'Contratar expertos', description: 'Necesito un servicio para mi hogar u obra.', icon: 'home-outline' },
  { value: 'expert', title: 'Trabajar como experto', description: 'Quiero postularme y recibir servicios.', icon: 'construct-outline' },
];

export default function RegisterScreen() {
  const [accountType, setAccountType] = useState<AccountType>('client');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Nombre, correo y contraseña son obligatorios.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          city: city.trim() || null,
          // El backend crea la postulación cuando account_type = 'expert'.
          account_type: accountType,
        },
      },
    });
    setLoading(false);
    if (authError) {
      setError(translateAuthError(authError.message));
      return;
    }
    // Con confirmación de correo deshabilitada, la sesión queda activa y el layout raíz redirige.
  };

  return (
    <Screen>
      <View style={styles.wrapper}>
        <Brand tagline="Crea tu cuenta en Xpertos" />
        <Card style={styles.card}>
          <Text style={styles.title}>Registro</Text>
          <ErrorBanner message={error} />

          <Text style={styles.label}>¿Qué quieres hacer en Xpertos?</Text>
          <View style={styles.types}>
            {ACCOUNT_TYPES.map((type) => {
              const selected = accountType === type.value;
              return (
                <Pressable
                  key={type.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setAccountType(type.value)}
                  style={[styles.type, selected && styles.typeSelected]}>
                  <Ionicons name={type.icon} size={22} color={selected ? colors.primary : colors.textMuted} />
                  <Text style={[styles.typeTitle, selected && styles.typeTitleSelected]}>{type.title}</Text>
                  <Text style={styles.typeDescription}>{type.description}</Text>
                </Pressable>
              );
            })}
          </View>
          {accountType === 'expert' ? (
            <InfoBanner message="Después de registrarte completarás tu postulación y subirás tus documentos. Un operador la revisará antes de activarte como experto." />
          ) : null}

          <Input label="Nombre completo" value={fullName} onChangeText={setFullName} autoComplete="name" placeholder="Ana Pérez" />
          <Input
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="tu@correo.com"
          />
          <Input
            label="Teléfono"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="300 000 0000"
          />
          <Input label="Ciudad" value={city} onChangeText={setCity} placeholder="Bogotá" />
          <Input
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            onSubmitEditing={submit}
          />
          <Button title="Crear cuenta" onPress={submit} loading={loading} />
          <Text style={styles.footer}>
            ¿Ya tienes cuenta?{' '}
            <Link href="/(auth)/login" style={styles.link}>
              Ingresa
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
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  types: { flexDirection: 'row', gap: spacing.sm },
  type: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  typeTitleSelected: { color: colors.primaryHover },
  typeDescription: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
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
