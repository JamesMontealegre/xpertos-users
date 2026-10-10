import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBanner, Screen, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

type ViewOption = {
  key: 'client' | 'applicant' | 'expert';
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const ADMIN_PANEL_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? 'https://admin.xpertos.com.co';

const VIEWS: ViewOption[] = [
  { key: 'client', title: 'Cliente', description: 'Solicitar servicios, pagar, descargar el contrato y calificar.', icon: 'home-outline' },
  { key: 'applicant', title: 'Aspirante a experto', description: 'Postulación y carga de documentos.', icon: 'document-text-outline' },
  { key: 'expert', title: 'Experto', description: 'Cotizaciones, jornadas, disponibilidad y perfil.', icon: 'construct-outline' },
];

/**
 * Selector de vistas del superadmin: puede entrar a cualquier frente de la app para probarlo. Las
 * cuentas normales son cliente O aspirante/experto, nunca ambas; los agentes ven un aviso con el
 * enlace al panel de operación.
 */
export default function AdminScreen() {
  const guard = useRoleGuard(['admin'], { agents: true });
  const { signOut, profile, session } = useAuth();
  const [error, setError, errorSeq] = useErrorState();
  const [busy, setBusy] = useState<ViewOption['key'] | null>(null);
  if (guard) return guard;

  const open = async (view: ViewOption['key']) => {
    if (!session || !profile) return;
    setError(null);
    setBusy(view);
    try {
      if (view === 'expert') {
        // La vista de experto necesita un perfil de experto; se crea una sola vez.
        const { data: existing } = await supabase.from('expert_profiles').select('user_id').eq('user_id', session.user.id).maybeSingle();
        if (!existing) {
          const { error: insertError } = await supabase.from('expert_profiles').insert({
            user_id: session.user.id,
            bio: 'Perfil de experto del super admin (pruebas).',
            approved_by: session.user.id,
          });
          if (insertError) throw new Error(insertError.message);
        }
        router.replace('/(expert)/assigned');
      } else if (view === 'applicant') {
        router.replace('/(applicant)/application');
      } else {
        router.replace('/(client)');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la vista.');
    } finally {
      setBusy(null);
    }
  };

  if (!profile?.is_super_admin) {
    return (
      <Screen>
        <View style={styles.wrapper}>
          <Brand tagline={`Agente · ${profile?.full_name || profile?.email || ''}`} />
          <Card style={styles.agent}>
            <Text style={styles.optionTitle}>Tu cuenta es de agente de operación</Text>
            <Text style={styles.optionDescription}>
              Las solicitudes, los servicios, los pagos y las postulaciones se gestionan en el panel de operación.
            </Text>
            <Button title="Abrir el panel de operación" onPress={() => Linking.openURL(ADMIN_PANEL_URL)} />
          </Card>
          <Button title="Cerrar sesión" variant="outline" onPress={signOut} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.wrapper}>
        <Brand tagline={`Superadmin · ${profile?.full_name || profile?.email || ''}`} />
        <Text style={styles.help}>
          Elige qué frente de la app quieres probar. Para gestionar solicitudes, servicios y pagos usa el panel de administración web.
        </Text>
        <ErrorBanner seq={errorSeq} message={error} />
        {VIEWS.map((view) => (
          <Pressable key={view.key} accessibilityRole="button" onPress={() => open(view.key)} disabled={busy !== null}>
            <Card style={[styles.option, busy === view.key && styles.optionBusy]}>
              <View style={styles.icon}>
                <Ionicons name={view.icon} size={24} color={colors.primary} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{view.title}</Text>
                <Text style={styles.optionDescription}>{view.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Card>
          </Pressable>
        ))}
        <Button title="Cerrar sesión" variant="outline" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center', gap: spacing.md },
  help: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  optionBusy: { opacity: 0.6 },
  agent: { gap: spacing.md, padding: spacing.lg },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  optionDescription: { fontSize: 13, color: colors.textMuted },
});
