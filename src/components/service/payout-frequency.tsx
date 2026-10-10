import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { SectionBody, SectionTitle } from '@/components/ui/card';
import { ErrorBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums, Tables } from '@/lib/database.types';
import { payoutFrequencies, payoutFrequencyLabel } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useFeedback } from '@/providers/feedback';

type Props = {
  service: Tables<'services'>;
  userId: string;
  onChanged: () => Promise<void>;
  /** Dentro de una sección plegable: sin título ni tarjeta propia. */
  embedded?: boolean;
};

const MIN_SERVICES = 5;

/**
 * Periodicidad con la que el experto recibe el pago. Se elige con el servicio Pendiente de pago o
 * Programado; las opciones distintas a "Obra terminada" exigen más de 5 servicios cerrados satisfactoriamente.
 */
export function PayoutFrequencySection({ service, userId, onChanged, embedded }: Props) {
  const editable = service.status === 'pending_payment' || service.status === 'scheduled';
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<Enums<'payout_frequency'>>(service.payout_frequency);
  const [saving, setSaving] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const { confirm, toast } = useFeedback();

  // Si la periodicidad guardada cambia (p. ej. tras recargar), la selección se ajusta durante el render.
  const [savedFrequency, setSavedFrequency] = useState(service.payout_frequency);
  if (savedFrequency !== service.payout_frequency) {
    setSavedFrequency(service.payout_frequency);
    setSelected(service.payout_frequency);
  }

  useEffect(() => {
    if (!editable) return;
    let active = true;
    Promise.all([
      supabase.rpc('expert_can_choose_frequency', { p_expert_id: userId }),
      supabase.rpc('expert_satisfactory_count', { p_expert_id: userId }),
    ]).then(([canChoose, satisfactory]) => {
      if (!active) return;
      if (canChoose.error || satisfactory.error) {
        setError(`No pudimos consultar tu historial: ${(canChoose.error ?? satisfactory.error)?.message}`);
        setEligible(false);
        return;
      }
      setEligible(Boolean(canChoose.data));
      setCount(satisfactory.data ?? 0);
    });
    return () => {
      active = false;
    };
  }, [editable, userId, setError]);

  const save = async () => {
    setError(null);
    const ok = await confirm({
      title: 'Guardar periodicidad',
      message: `Xpertos te pagará este servicio: ${payoutFrequencyLabel(selected).toLowerCase()}.`,
      confirmLabel: 'Guardar',
    });
    if (!ok) return;
    setSaving(true);
    const { error: rpcError } = await supabase.rpc('set_payout_frequency', { p_service_id: service.id, p_frequency: selected });
    setSaving(false);
    if (rpcError) return setError(`No se pudo guardar la periodicidad: ${rpcError.message}`);
    toast('Periodicidad guardada.', 'success');
    await onChanged();
  };

  if (!editable) {
    return (
      <SectionBody plain={embedded} style={styles.inline}>
        <Ionicons name="wallet-outline" size={18} color={colors.primary} />
        <Text style={styles.inlineText}>
          Periodicidad de tu pago: <Text style={styles.inlineValue}>{payoutFrequencyLabel(service.payout_frequency)}</Text>
        </Text>
      </SectionBody>
    );
  }

  const lockedText = `Disponible con más de ${MIN_SERVICES} servicios cerrados satisfactoriamente (llevas ${count ?? 0})`;

  return (
    <>
      {embedded ? null : <SectionTitle>Periodicidad de tu pago</SectionTitle>}
      <SectionBody plain={embedded} style={styles.card}>
        <Text style={styles.help}>
          Elige cada cuánto quieres que Xpertos te pague este servicio.
        </Text>
        <ErrorBanner seq={errorSeq} message={error} />
        <View style={styles.options} accessibilityRole="radiogroup">
          {payoutFrequencies.map((option) => {
            const locked = option.value !== 'on_completion' && eligible !== true;
            const isSelected = selected === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                aria-checked={isSelected}
                aria-disabled={locked}
                disabled={locked}
                onPress={() => setSelected(option.value)}
                style={[styles.option, isSelected && styles.optionSelected, locked && styles.optionLocked]}>
                <Ionicons
                  name={locked ? 'lock-closed-outline' : isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={locked ? colors.textMuted : isSelected ? colors.primary : colors.textMuted}
                />
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected, locked && styles.lockedLabel]}>
                    {option.label}
                  </Text>
                  {locked ? <Text style={styles.lockedText}>{lockedText}</Text> : null}
                  {option.value === 'daily' && !locked ? (
                    <Text style={styles.optionHint}>Con pago diario debes registrar todas las jornadas.</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Button
          title="Guardar periodicidad"
          onPress={save}
          loading={saving}
          disabled={eligible === null}
        />
        <Text style={styles.current}>Actual: {payoutFrequencyLabel(service.payout_frequency)}</Text>
      </SectionBody>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  options: { gap: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionLocked: { backgroundColor: colors.background },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15, color: colors.text, fontWeight: '600' },
  optionLabelSelected: { color: colors.primary, fontWeight: '800' },
  lockedLabel: { color: colors.textMuted },
  lockedText: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  optionHint: { fontSize: 12, color: colors.textMuted },
  current: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inlineText: { flex: 1, fontSize: 14, color: colors.text },
  inlineValue: { fontWeight: '700' },
});
