import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loading, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatCOP } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

type Attempt = Pick<Tables<'online_payments'>, 'service_id' | 'amount' | 'status'>;

const POLL_MS = 4000;
// Wompi avisa el resultado por el webhook; si tarda más que esto, el pago se ve en el servicio cuando llegue.
const POLL_LIMIT_MS = 120_000;

/**
 * Regreso desde Wompi: muestra el resultado del pago en línea. Mientras siga pendiente, pide al servidor verificar la
 * transacción en Wompi (la registra igual que el webhook, por si este se demora) y vuelve a consultar el intento.
 */
export default function PaymentResultScreen() {
  // Wompi agrega `id` (la transacción) al volver del checkout.
  const { ref, id } = useLocalSearchParams<{ ref: string; id?: string }>();
  const { session } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null | undefined>(undefined);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!session || !ref) return;
    let active = true;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (id) await supabase.functions.invoke('wompi-checkout', { body: { action: 'verify', reference: ref, transaction_id: id } });
      const { data } = await supabase.from('online_payments').select('service_id, amount, status').eq('reference', ref).maybeSingle();
      if (!active) return;
      setAttempt(data ?? null);
      if (data?.status !== 'pending') return;
      if (Date.now() - started > POLL_LIMIT_MS) return setTimedOut(true);
      timer = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [session, ref, id]);

  const goToService = () => (attempt ? router.replace(`/service/${attempt.service_id}`) : router.replace('/'));

  if (session && attempt === undefined) return <Loading message="Consultando tu pago…" />;

  const info = !session
    ? { icon: 'log-in-outline' as const, tone: colors.primary, title: 'Inicia sesión', text: 'Entra a tu cuenta para ver el resultado del pago.' }
    : !attempt
      ? { icon: 'help-circle-outline' as const, tone: colors.primary, title: 'No encontramos el pago', text: 'Revisa el estado del pago en el detalle de tu servicio.' }
      : attempt.status === 'approved'
        ? {
            icon: 'checkmark-circle' as const,
            tone: colors.success,
            title: 'Pago aprobado',
            text: `Recibimos ${formatCOP(attempt.amount)}. Ya quedó aplicado a tu plan de pagos y te enviamos la confirmación por correo.`,
          }
        : attempt.status === 'pending'
          ? {
              icon: 'time-outline' as const,
              tone: colors.primary,
              title: timedOut ? 'Tu pago sigue en proceso' : 'Confirmando tu pago…',
              text: timedOut
                ? 'El banco aún no confirma el pago. Te avisamos apenas quede aprobado; no hace falta pagar de nuevo.'
                : `Estamos esperando la confirmación de ${formatCOP(attempt.amount)}. Puede tardar unos segundos.`,
            }
          : {
              icon: 'close-circle' as const,
              tone: colors.danger,
              title: 'El pago no se completó',
              text: 'No se hizo ningún cobro. Puedes intentarlo de nuevo con otro medio o pagar por transferencia.',
            };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false, title: 'Pago en línea' }} />
      <View style={styles.wrapper}>
        <Brand />
        <Card style={styles.card}>
          <Ionicons name={info.icon} size={44} color={info.tone} />
          <Text style={styles.title}>{info.title}</Text>
          <Text style={styles.help}>{info.text}</Text>
          <Button
            title={session ? 'Ver el servicio' : 'Iniciar sesión'}
            variant={attempt?.status === 'pending' && !timedOut ? 'outline' : 'primary'}
            onPress={goToService}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md, paddingVertical: spacing.lg, maxWidth: 720, width: '100%', alignSelf: 'center' },
  card: { gap: spacing.md, padding: spacing.lg, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  help: { fontSize: 15, lineHeight: 22, color: colors.textMuted, textAlign: 'center' },
});
