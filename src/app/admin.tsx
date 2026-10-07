import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { colors, spacing } from '@/constants/theme';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { useAuth } from '@/providers/auth';

export default function AdminScreen() {
  const guard = useRoleGuard(['admin']);
  const { signOut, profile } = useAuth();
  if (guard) return guard;

  return (
    <Screen>
      <View style={styles.wrapper}>
        <Card style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="shield-checkmark-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Hola, {profile?.full_name || 'operador'}</Text>
          <Text style={styles.text}>
            Esta app es para clientes y expertos. Como administrador, usa el panel de administración web para gestionar
            solicitudes, servicios y pagos.
          </Text>
          <Button title="Cerrar sesión" variant="outline" onPress={signOut} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'center', maxWidth: 440, width: '100%', alignSelf: 'center' },
  card: { alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  text: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
