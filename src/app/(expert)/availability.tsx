import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, Loading, Screen } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatTime, isValidTime } from '@/lib/format';
import { weekdays } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

type Slot = Tables<'expert_availability'>;

const weekdayOptions = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: weekdays[d] }));

export default function AvailabilityScreen() {
  const { session } = useAuth();
  const [expertProfile, setExpertProfile] = useState<Tables<'expert_profiles'> | null | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [draft, setDraft] = useState({ weekday: '1', start: '', end: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: ep, error: epError }, { data: av, error: avError }] = await Promise.all([
      supabase.from('expert_profiles').select('*').eq('user_id', session.user.id).maybeSingle(),
      supabase
        .from('expert_availability')
        .select('*')
        .eq('expert_id', session.user.id)
        .order('weekday')
        .order('start_time'),
    ]);
    if (epError || avError) {
      setError(`No pudimos cargar tu disponibilidad: ${(epError ?? avError)?.message}`);
      setExpertProfile(null);
      return;
    }
    setError(null);
    setExpertProfile(ep);
    setSlots(av ?? []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleAvailable = async (value: boolean) => {
    if (!session || !expertProfile) return;
    setExpertProfile({ ...expertProfile, is_available: value });
    const { error: updateError } = await supabase
      .from('expert_profiles')
      .update({ is_available: value })
      .eq('user_id', session.user.id);
    if (updateError) {
      setError(`No se pudo actualizar tu disponibilidad: ${updateError.message}`);
      setExpertProfile({ ...expertProfile, is_available: !value });
    }
  };

  const addSlot = async () => {
    if (!session) return;
    setError(null);
    if (!isValidTime(draft.start) || !isValidTime(draft.end)) return setError('Las horas deben tener el formato HH:mm (p. ej. 08:00).');
    if (draft.start >= draft.end) return setError('La hora final debe ser posterior a la inicial.');
    setSaving(true);
    const { error: insertError } = await supabase.from('expert_availability').insert({
      expert_id: session.user.id,
      weekday: Number(draft.weekday),
      start_time: draft.start,
      end_time: draft.end,
    });
    setSaving(false);
    if (insertError) return setError(`No se pudo agregar la franja: ${insertError.message}`);
    setDraft((d) => ({ ...d, start: '', end: '' }));
    await load();
  };

  const removeSlot = async (slot: Slot) => {
    setError(null);
    const { error: deleteError } = await supabase.from('expert_availability').delete().eq('id', slot.id);
    if (deleteError) return setError(`No se pudo eliminar la franja: ${deleteError.message}`);
    setSlots((prev) => prev.filter((s) => s.id !== slot.id));
  };

  if (expertProfile === undefined) return <Loading />;

  return (
    <Screen title="Disponibilidad" subtitle="Indica cuándo puedes atender servicios" refreshing={refreshing} onRefresh={refresh} withTabs>
      <ErrorBanner message={error} />

      <Card style={styles.switchCard}>
        <View style={styles.switchText}>
          <Text style={styles.switchTitle}>Disponible para nuevos servicios</Text>
          <Text style={styles.help}>Si lo desactivas, el operador no te asignará servicios nuevos.</Text>
        </View>
        <Switch
          value={expertProfile?.is_available ?? false}
          onValueChange={toggleAvailable}
          disabled={!expertProfile}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#FFFFFF"
        />
      </Card>

      <SectionTitle>Horario semanal</SectionTitle>
      <Card style={styles.card}>
        {slots.length === 0 ? (
          <Text style={styles.muted}>Aún no has definido franjas. Agrega al menos una para que te asignen servicios.</Text>
        ) : (
          slots.map((slot) => (
            <View key={slot.id} style={styles.slotRow}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={styles.slotText}>
                {weekdays[slot.weekday]} · {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Eliminar franja" onPress={() => removeSlot(slot)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <SectionTitle>Agregar franja</SectionTitle>
      <Card style={styles.card}>
        <Select label="Día" options={weekdayOptions} value={draft.weekday} onChange={(weekday) => setDraft((d) => ({ ...d, weekday }))} />
        <View style={styles.timeRow}>
          <Input
            label="Desde"
            placeholder="08:00"
            value={draft.start}
            onChangeText={(start) => setDraft((d) => ({ ...d, start }))}
            containerStyle={styles.timeInput}
          />
          <Input
            label="Hasta"
            placeholder="17:00"
            value={draft.end}
            onChangeText={(end) => setDraft((d) => ({ ...d, end }))}
            containerStyle={styles.timeInput}
          />
        </View>
        <Button title="Agregar franja" variant="outline" onPress={addSlot} loading={saving} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  switchCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchText: { flex: 1, gap: 2 },
  switchTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  help: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  muted: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  slotText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeInput: { flex: 1 },
});
