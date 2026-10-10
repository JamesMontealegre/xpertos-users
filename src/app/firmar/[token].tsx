import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Brand } from '@/components/brand';
import { MarkdownView } from '@/components/markdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ErrorBanner, Loading, Screen, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate, formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useFeedback } from '@/providers/feedback';

type SignView =
  | { state: 'invalid' }
  | { state: 'void' | 'outdated' | 'expired'; title: string }
  | { state: 'signed'; title: string; signed_at: string; method: 'app' | 'email' }
  | {
      state: 'pending';
      title: string;
      client_name: string | null;
      email: string;
      version: number;
      body_md: string;
      body_hash: string;
      expires_at: string;
      code_sent_at: string | null;
      codes_left: number;
    };

const RESEND_SECONDS = 60;

/**
 * Firma del contrato desde el enlace del correo, sin iniciar sesión: el cliente lee el contrato, pide un código
 * de 6 dígitos que le llega al mismo correo y firma. La base valida el enlace, el código y registra la evidencia.
 */
export default function SignContractScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { confirm, toast } = useFeedback();
  const [view, setView] = useState<SignView | null>(null);
  const [error, setError, errorSeq] = useErrorState();
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [sending, setSending] = useState(false);
  const [signing, setSigning] = useState(false);

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('contract_sign_view', { p_token: token ?? '' });
    if (rpcError) return setError(`No pudimos abrir el contrato: ${rpcError.message}`);
    setView(data as SignView);
  }, [token, setError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Último código enviado (en esta visita o antes, si recargó la página) y la espera para reenviar.
  const serverSentAt = view?.state === 'pending' && view.code_sent_at ? Date.parse(view.code_sent_at) : null;
  const lastSent = sentAt ?? serverSentAt;
  const wait = lastSent ? Math.min(RESEND_SECONDS, Math.max(0, Math.ceil(RESEND_SECONDS - (now - lastSent) / 1000))) : 0;

  useEffect(() => {
    if (!lastSent) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lastSent]);

  if (!view) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false, title: 'Firmar contrato' }} />
        {error ? <ErrorBanner seq={errorSeq} message={error} /> : <Loading message="Abriendo tu contrato…" />}
      </Screen>
    );
  }

  const openApp = () => router.replace('/');

  if (view.state !== 'pending') {
    const info = {
      invalid: {
        icon: 'link-outline' as const,
        title: 'Enlace no válido',
        text: 'Revisa que abriste el enlace completo del correo, o firma el contrato desde la app.',
      },
      expired: {
        icon: 'time-outline' as const,
        title: 'El enlace venció',
        text: 'Por seguridad, el enlace sirve 7 días. Firma el contrato desde la app, en el detalle del servicio.',
      },
      outdated: {
        icon: 'refresh-outline' as const,
        title: 'El contrato cambió',
        text: 'Hay una versión más reciente de este contrato. Te la enviamos a tu correo; también puedes firmarla en la app.',
      },
      void: { icon: 'close-circle-outline' as const, title: 'Contrato anulado', text: 'Este contrato ya no está vigente.' },
      signed: {
        icon: 'checkmark-circle' as const,
        title: 'Contrato firmado',
        text:
          view.state === 'signed'
            ? `Firmaste este contrato el ${formatDateTime(view.signed_at)} y te enviamos la constancia a tu correo.`
            : '',
      },
    }[view.state];
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false, title: 'Firmar contrato' }} />
        <View style={styles.wrapper}>
          <Brand />
          <Card style={[styles.card, styles.center]}>
            <Ionicons name={info.icon} size={44} color={view.state === 'signed' ? colors.success : colors.primary} />
            <Text style={styles.title}>{info.title}</Text>
            {'title' in view ? <Text style={styles.serviceName}>{view.title}</Text> : null}
            <Text style={[styles.help, styles.textCenter]}>{info.text}</Text>
            <Button title="Abrir la app" variant={view.state === 'signed' ? 'primary' : 'outline'} onPress={openApp} />
          </Card>
        </View>
      </Screen>
    );
  }

  const startAct = view.body_md.includes('acta de inicio');
  const firstName = view.client_name?.trim().split(/\s+/)[0];

  const sendCode = async () => {
    setError(null);
    if (!accepted) return setError('Marca que leíste y aceptas el contrato para pedir el código.');
    setSending(true);
    const { data, error: rpcError } = await supabase.rpc('contract_sign_send_code', { p_token: token ?? '' });
    setSending(false);
    if (rpcError) return setError(rpcError.message);
    const sent = Date.now();
    setSentAt(sent);
    setNow(sent);
    setCode('');
    toast(`Te enviamos un código a ${(data as { email?: string } | null)?.email ?? view.email}.`, 'success');
  };

  const sign = async () => {
    setError(null);
    if (!accepted) return setError('Marca que leíste y aceptas el contrato.');
    if (code.length !== 6) return setError('Escribe el código de 6 dígitos que te enviamos al correo.');
    const ok = await confirm({
      title: startAct ? 'Firmar el acta de inicio' : 'Firmar el contrato',
      message: 'Tu firma electrónica queda registrada con la fecha, tu IP, el código de verificación y el código del documento.',
      confirmLabel: 'Firmar',
    });
    if (!ok) return;
    setSigning(true);
    const userAgent = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : `xpertos-app/${Platform.OS}`;
    const { data, error: rpcError } = await supabase.rpc('contract_sign_confirm', {
      p_token: token ?? '',
      p_code: code,
      p_user_agent: userAgent,
    });
    setSigning(false);
    if (rpcError) return setError(rpcError.message);
    const result = data as { ok: boolean; message?: string } | null;
    if (!result?.ok) return setError(result?.message ?? 'No pudimos verificar el código.');
    toast('¡Listo! Firmaste el contrato. Te enviamos la constancia al correo.', 'success');
    await load();
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false, title: 'Firmar contrato' }} />
      <View style={styles.wrapper}>
        <Brand />
        <Card style={styles.card}>
          <Text style={styles.title}>{startAct ? 'Firma el acta de inicio' : 'Firma tu contrato'}</Text>
          <Text style={styles.help}>
            {firstName ? `Hola ${firstName}. ` : ''}Este es tu contrato con Xpertos para «{view.title}». Léelo y confírmalo con el código
            que te enviaremos a {view.email}.
          </Text>
          <ErrorBanner seq={errorSeq} message={error} />

          <ScrollView style={styles.contract} contentContainerStyle={styles.contractContent} nestedScrollEnabled>
            <MarkdownView>{view.body_md}</MarkdownView>
          </ScrollView>
          <Text style={styles.meta}>
            Versión {view.version} · Código del documento {view.body_hash.slice(0, 12)}…
          </Text>

          <Checkbox checked={accepted} onChange={setAccepted} label="He leído y acepto este contrato" />

          {lastSent ? (
            <>
              <Text style={styles.help}>Te enviamos un código de 6 dígitos a {view.email}. Vence en 10 minutos.</Text>
              <Input
                label="Código de verificación"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                onSubmitEditing={sign}
                style={styles.codeInput}
              />
              <Button title="Firmar" onPress={sign} loading={signing} disabled={!accepted || code.length !== 6} />
              <Button
                title={wait > 0 ? `Reenviar código en ${wait} s` : 'Reenviar código'}
                variant="ghost"
                size="sm"
                onPress={sendCode}
                loading={sending}
                disabled={wait > 0 || sending}
              />
            </>
          ) : (
            <Button title="Enviarme el código" onPress={sendCode} loading={sending} disabled={!accepted} />
          )}

          <Text style={styles.legal}>
            Tu aceptación, junto con la fecha, tu IP, el código de verificación y el hash del documento, constituye tu firma
            electrónica (Ley 527 de 1999 y Decreto 2364 de 2012).
          </Text>
        </Card>
        <Text style={[styles.meta, styles.textCenter]}>
          El enlace es personal y sirve hasta el {formatDate(view.expires_at)}. También puedes firmar desde la app.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md, paddingVertical: spacing.lg, maxWidth: 720, width: '100%', alignSelf: 'center' },
  card: { gap: spacing.md, padding: spacing.lg },
  center: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  serviceName: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
  help: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  contract: {
    maxHeight: 460,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.background,
  },
  contractContent: { padding: spacing.md },
  meta: { fontSize: 12, color: colors.textMuted },
  codeInput: { fontSize: 22, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  legal: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
