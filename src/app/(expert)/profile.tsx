import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProfileForm } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, InfoBanner, Screen, useErrorState } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { StarRating } from '@/components/ui/star-rating';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import type { Enums, Tables } from '@/lib/database.types';
import { isValidNequi, payoutMethodLabel, payoutMethods } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

export default function ExpertProfileScreen() {
  const { session } = useAuth();
  const [expertProfile, setExpertProfile] = useState<Tables<'expert_profiles'> | null>(null);
  const [categories, setCategories] = useState<Tables<'service_categories'>[]>([]);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const [payoutMethod, setPayoutMethod] = useState<Enums<'payout_method'> | null>(null);
  const [payoutAccount, setPayoutAccount] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSaved, setPayoutSaved] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: ep }, { data: cats }] = await Promise.all([
      supabase.from('expert_profiles').select('*').eq('user_id', session.user.id).maybeSingle(),
      supabase.from('service_categories').select('*'),
    ]);
    setExpertProfile(ep);
    setBio(ep?.bio ?? '');
    setPayoutMethod(ep?.payout_method ?? null);
    setPayoutAccount(ep?.payout_account ?? '');
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

  const savePayout = async () => {
    if (!session) return;
    setPayoutError(null);
    setPayoutSaved(false);
    if (!payoutMethod) return setPayoutError('Elige cómo quieres recibir tus pagos.');
    let account: string | null = payoutAccount.trim() || null;
    if (payoutMethod === 'nequi') {
      if (!account || !isValidNequi(account)) return setPayoutError('El número Nequi debe ser un celular de 10 dígitos que empiece por 3.');
      account = account.replace(/\D/g, '');
    }
    if (payoutMethod === 'efecty') account = null;
    setSavingPayout(true);
    const { error: updateError } = await supabase
      .from('expert_profiles')
      .update({ payout_method: payoutMethod, payout_account: account })
      .eq('user_id', session.user.id);
    setSavingPayout(false);
    if (updateError) return setPayoutError(`No pudimos guardar tu medio de pago: ${updateError.message}`);
    setPayoutSaved(true);
    await load();
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
        <ErrorBanner seq={errorSeq} message={error} />
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

      {expertProfile ? (
        <>
          <SectionTitle>Medio de pago</SectionTitle>
          <Card style={styles.card}>
            <Text style={styles.current}>
              Actual: <Text style={styles.currentValue}>{payoutMethodLabel(expertProfile.payout_method)}</Text>
              {expertProfile.payout_account ? ` · ${expertProfile.payout_account}` : ''}
            </Text>
            <ErrorBanner message={payoutError} />
            {payoutSaved ? <InfoBanner tone="success" message="Medio de pago actualizado." /> : null}
            <Select
              label="¿Cómo quieres recibir tus pagos?"
              placeholder="Elige un medio de pago"
              options={payoutMethods.map((m) => ({ value: m.value, label: m.label, description: m.description }))}
              value={payoutMethod}
              onChange={(method) => {
                setPayoutMethod(method);
                setPayoutSaved(false);
                if (method !== expertProfile.payout_method) setPayoutAccount('');
                else setPayoutAccount(expertProfile.payout_account ?? '');
              }}
            />
            {payoutMethod === 'nequi' ? (
              <Input
                label="Número Nequi"
                value={payoutAccount}
                onChangeText={(v) => setPayoutAccount(v.replace(/[^0-9 ]/g, ''))}
                keyboardType="phone-pad"
                placeholder="300 000 0000"
              />
            ) : null}
            {payoutMethod === 'bank_account' ? (
              <>
                <Input
                  label="Banco, tipo y número de cuenta"
                  value={payoutAccount}
                  onChangeText={setPayoutAccount}
                  placeholder="Bancolombia · Ahorros · 000-000000-00"
                  hint="La cuenta debe estar a tu nombre. Si es una cuenta nueva, envía la certificación bancaria a Xpertos."
                />
              </>
            ) : null}
            {payoutMethod === 'efecty' ? (
              <InfoBanner message="Te pagaremos en Puntos Efecty a tu nombre, con tu número de cédula." />
            ) : null}
            <Button title="Guardar medio de pago" variant="outline" onPress={savePayout} loading={savingPayout} />
          </Card>
        </>
      ) : null}

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
  current: { color: colors.textMuted, fontSize: 14 },
  currentValue: { color: colors.text, fontWeight: '700' },
});
