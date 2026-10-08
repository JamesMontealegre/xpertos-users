import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBanner, Screen } from '@/components/ui/screen';
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

const VIEWS: ViewOption[] = [
  { key: 'client', title: 'Cliente', description: 'Solicitar servicios, pagar, descargar el contrato y calificar.', icon: 'home-outline' },
  { key: 'applicant', title: 'Aspirante a experto', description: 'Postulación y carga de documentos.', icon: 'document-text-outline' },
  { key: 'expert', title: 'Experto', description: 'Cotizaciones, jornadas, disponibilidad y perfil.', icon: 'construct-outline' },
];

/**
 * Selector de vistas del super admin. Un administrador puede entrar a cualquier frente de la app
 * para probarlo; las cuentas normales son cliente O aspirante/experto, nunca ambas.
 */
export default function AdminScreen() {
  const guard = useRoleGuard(['admin']);
  const { signOut, profile, session } = useAuth();
  const [error, setError] = useState<string | null>(null);
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

  return (
    <Screen>
      <View style={styles.wrapper}>
        <Brand tagline={`Super admin · ${profile?.full_name || profile?.email || ''}`} />
        <Text style={styles.help}>
          Elige qué frente de la app quieres probar. Para gestionar solicitudes, servicios y pagos usa el panel de administración web.
        </Text>
        <ErrorBanner message={error} />
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
