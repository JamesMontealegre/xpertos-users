import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Brand } from '@/components/brand';
import { MarkdownView } from '@/components/markdown';
import { contractTitle, userAgentLabel } from '@/components/service/contract';
import { IdentityForm } from '@/components/signature/identity-form';
import { SignSheet } from '@/components/signature/sign-sheet';
import { type SignatureData } from '@/components/signature/signature-pad';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ErrorBanner, InfoBanner, Loading, Screen, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import { downloadContractPdf } from '@/lib/contract-file';
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
      statement: string | null;
      needs_identity: boolean;
      expires_at: string;
      code_sent_at: string | null;
      codes_left: number;
    };

const RESEND_SECONDS = 60;
/** En la web sin pantalla táctil (computador): se recomienda firmar desde el celular. */
const desktopWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !('ontouchstart' in window) && !(navigator.maxTouchPoints > 0);

/**
 * Firma del contrato desde el enlace del correo, sin iniciar sesión: el cliente registra su documento (si aún no lo
 * tiene), lee el contrato, pide un código de 6 dígitos que le llega al mismo correo y firma a mano alzada. La base
 * valida el enlace y el código y registra la evidencia; después puede descargar el PDF con las firmas.
 */
export default function SignContractScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { toast } = useFeedback();
  const [view, setView] = useState<SignView | null>(null);
  const [error, setError, errorSeq] = useErrorState();
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  const downloadPdf = async () => {
    setError(null);
    setDownloading(true);
    try {
      await downloadContractPdf({ token: token ?? '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos descargar el contrato.');
    } finally {
      setDownloading(false);
    }
  };

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
            <ErrorBanner seq={errorSeq} message={error} />
            {view.state === 'signed' ? <Button title="Descargar contrato firmado (PDF)" onPress={downloadPdf} loading={downloading} /> : null}
            <Button title="Abrir la app" variant="outline" onPress={openApp} />
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

  const saveIdentity = async (documentType: string, documentNumber: string) => {
    const { data, error: rpcError } = await supabase.rpc('contract_sign_set_identity', {
      p_token: token ?? '',
      p_document_type: documentType,
      p_document_number: documentNumber,
    });
    if (rpcError) return rpcError.message;
    setView(data as SignView);
    toast('Documento guardado. Ya puedes firmar.', 'success');
    return null;
  };

  const openSheet = () => {
    setError(null);
    if (!accepted) return setError('Marca que leíste y aceptas el contrato.');
    if (code.length !== 6) return setError('Escribe el código de 6 dígitos que te enviamos al correo.');
    setSheetOpen(true);
  };

  const sign = async (signature: SignatureData) => {
    const { data, error: rpcError } = await supabase.rpc('contract_sign_confirm', {
      p_token: token ?? '',
      p_code: code,
      p_signature_svg: signature.path,
      p_signature_width: signature.width,
      p_signature_height: signature.height,
      p_user_agent: userAgentLabel(),
    });
    if (rpcError) return rpcError.message;
    const result = data as { ok: boolean; message?: string } | null;
    if (!result?.ok) {
      // Código errado: se cierra la hoja para corregirlo; la firma se dibuja de nuevo.
      setSheetOpen(false);
      setError(result?.message ?? 'No pudimos verificar el código.');
      return null;
    }
    setSheetOpen(false);
    toast('¡Listo! Firmaste el contrato. Ya puedes descargarlo en PDF; también te llega al correo.', 'success');
    await load();
    return null;
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false, title: 'Firmar contrato' }} />
      <View style={styles.wrapper}>
        <Brand />
        <Card style={styles.card}>
          <Text style={styles.title}>{startAct ? 'Firma el acta de inicio' : 'Firma tu contrato'}</Text>
          <Text style={styles.help}>
            {firstName ? `Hola ${firstName}. ` : ''}Este es tu contrato con Xpertos para «{view.title}». Léelo, confírmalo con el código
            que te enviaremos a {view.email} y fírmalo a mano alzada.
          </Text>
          <ErrorBanner seq={errorSeq} message={error} />
          {view.needs_identity ? <IdentityForm onSubmit={saveIdentity} /> : null}

          <ScrollView style={styles.contract} contentContainerStyle={styles.contractContent} nestedScrollEnabled>
            <MarkdownView>{view.body_md}</MarkdownView>
          </ScrollView>
          <Text style={styles.meta}>
            Versión {view.version} · Código del documento {view.body_hash.slice(0, 12)}…
          </Text>

          {view.needs_identity ? null : (
            <>
          {desktopWeb ? <InfoBanner message="Te recomendamos abrir este enlace en tu celular: con el dedo la firma sale más natural." /> : null}
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
                onSubmitEditing={openSheet}
                style={styles.codeInput}
              />
              <Button title="Firmar" onPress={openSheet} disabled={!accepted || code.length !== 6} />
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
            </>
          )}

          <Text style={styles.legal}>
            Tu firma a mano alzada, junto con la fecha, tu IP, el código de verificación y el código del documento, constituye tu
            firma electrónica (Ley 527 de 1999 y Decreto 2364 de 2012).
          </Text>
          <SignSheet
            visible={sheetOpen}
            title={contractTitle(view.body_md)}
            statement={view.statement}
            signerName={view.client_name}
            onCancel={() => setSheetOpen(false)}
            onConfirm={sign}
          />
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
