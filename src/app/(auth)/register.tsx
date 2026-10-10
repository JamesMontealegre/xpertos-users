import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, Screen, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import { supabase, translateAuthError } from '@/lib/supabase';
import {
  PASSWORD_MIN_LENGTH,
  cityError,
  confirmPasswordError,
  emailError,
  fullNameError,
  normalizePhone,
  passwordError,
  phoneError,
} from '@/lib/validation';

/** Los expertos no se registran aquí: se postulan en la landing y reciben su acceso por correo. */
const WORK_WITH_US_URL = `${process.env.EXPO_PUBLIC_SITE_URL ?? 'https://xpertos.com.co'}/#trabaja-con-nosotros`;

type Field = 'fullName' | 'email' | 'phone' | 'city' | 'password' | 'confirm';
type Values = Record<Field, string>;

function validate(v: Values): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string | null>> = {
    fullName: fullNameError(v.fullName),
    email: emailError(v.email),
    phone: phoneError(v.phone),
    city: cityError(v.city),
    password: passwordError(v.password),
    confirm: confirmPasswordError(v.password, v.confirm),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as Partial<Record<Field, string>>;
}

export default function RegisterScreen() {
  const [values, setValues] = useState<Values>({ fullName: '', email: '', phone: '', city: '', password: '', confirm: '' });
  // Los errores de un campo se muestran al salir de él o al intentar crear la cuenta.
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const [loading, setLoading] = useState(false);

  const errors = validate(values);
  const hasErrors = Object.keys(errors).length > 0;
  const fieldError = (field: Field) => ((submitted || touched[field]) && errors[field]) || null;
  const field = (name: Field) => ({
    value: values[name],
    onChangeText: (text: string) => setValues((v) => ({ ...v, [name]: text })),
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
    error: fieldError(name),
  });

  const submit = async () => {
    setError(null);
    setSubmitted(true);
    if (hasErrors) return;
    setLoading(true);
    // "Confirmar contraseña" solo valida el formulario: no se envía.
    const { error: authError } = await supabase.auth.signUp({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      options: {
        data: {
          full_name: values.fullName.trim().replace(/\s+/g, ' '),
          phone: normalizePhone(values.phone),
          city: values.city.trim(),
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
          <ErrorBanner seq={errorSeq} message={error ?? (submitted && hasErrors ? 'Revisa los campos marcados en rojo.' : null)} />

          <Text style={styles.help}>Crea tu cuenta para solicitar servicios para tu hogar u obra. Todos los campos son obligatorios.</Text>

          <Input label="Nombre completo" {...field('fullName')} autoComplete="name" placeholder="Ana Pérez" />
          <Input
            label="Correo electrónico"
            {...field('email')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="tu@correo.com"
          />
          <Input
            label="Celular"
            {...field('phone')}
            onChangeText={(text) => setValues((v) => ({ ...v, phone: text.replace(/[^\d\s+-]/g, '') }))}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="300 123 4567"
            maxLength={16}
          />
          <Input label="Ciudad" {...field('city')} placeholder="Bogotá" />
          <Input
            label="Contraseña"
            {...field('password')}
            secureTextEntry
            autoComplete="new-password"
            hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres, con letras y números.`}
          />
          <Input
            label="Confirmar contraseña"
            {...field('confirm')}
            secureTextEntry
            autoComplete="new-password"
            placeholder="Escríbela de nuevo"
            onSubmitEditing={submit}
          />
          <Button title="Crear cuenta" onPress={submit} loading={loading} />
          <Text style={styles.footer}>
            ¿Ya tienes cuenta?{' '}
            <Link href="/(auth)/login" style={styles.link}>
              Ingresa
            </Link>
          </Text>
          <Text style={styles.footer}>
            ¿Quieres trabajar como experto?{' '}
            <Text accessibilityRole="link" style={styles.link} onPress={() => Linking.openURL(WORK_WITH_US_URL)}>
              Postúlate aquí
            </Text>
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
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
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
