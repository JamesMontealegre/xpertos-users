import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProfileForm } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, InfoBanner, Screen } from '@/components/ui/screen';
import { StarRating } from '@/components/ui/star-rating';
import { colors, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

export default function ExpertProfileScreen() {
  const { session } = useAuth();
  const [expertProfile, setExpertProfile] = useState<Tables<'expert_profiles'> | null>(null);
  const [categories, setCategories] = useState<Tables<'service_categories'>[]>([]);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: ep }, { data: cats }] = await Promise.all([
      supabase.from('expert_profiles').select('*').eq('user_id', session.user.id).maybeSingle(),
      supabase.from('service_categories').select('*'),
    ]);
    setExpertProfile(ep);
    setBio(ep?.bio ?? '');
    setCategories(cats ?? []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveBio = async () => {
    if (!session) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    const { error: updateError } = await supabase.from('expert_profiles').update({ bio: bio.trim() || null }).eq('user_id', session.user.id);
    setSaving(false);
    if (updateError) return setError(`No pudimos guardar tu presentación: ${updateError.message}`);
    setSaved(true);
  };

  const categoryNames = categories.filter((c) => expertProfile?.category_ids.includes(c.id)).map((c) => c.name);

  return (
    <Screen title="Mi perfil" subtitle="Tus datos como experto" withTabs>
      {expertProfile ? (
        <Card style={styles.card}>
          <View style={styles.ratingRow}>
            <StarRating value={Number(expertProfile.rating_avg)} size={22} />
            <Text style={styles.ratingText}>
              {Number(expertProfile.rating_avg).toFixed(1)} · {expertProfile.rating_count}{' '}
              {expertProfile.rating_count === 1 ? 'calificación' : 'calificaciones'}
            </Text>
          </View>
          <Text style={styles.categories}>{categoryNames.length ? categoryNames.join(' · ') : 'Sin categorías asignadas'}</Text>
        </Card>
      ) : null}

      <SectionTitle>Presentación</SectionTitle>
      <Card style={styles.card}>
        <ErrorBanner message={error} />
        {saved ? <InfoBanner tone="success" message="Presentación actualizada." /> : null}
        <Input
          label="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          placeholder="Cuéntales a los clientes sobre tu experiencia"
          hint="Visible para el operador y los clientes de tus servicios."
        />
        <Button title="Guardar presentación" onPress={saveBio} loading={saving} />
      </Card>

      <SectionTitle>Datos de contacto</SectionTitle>
      <ProfileForm />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  ratingText: { color: colors.textMuted, fontSize: 14 },
  categories: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
