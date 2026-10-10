import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ErrorBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums, Tables } from '@/lib/database.types';
import { formatCOP } from '@/lib/format';
import { pricingModes } from '@/lib/labels';
import { supabase } from '@/lib/supabase';

type Mode = Enums<'pricing_mode'>;

function qty(value: number): string {
  return Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

/**
 * Cotización presentada al cliente: la mano de obra del experto, las actividades, la lista de materiales
 * y las dos opciones con su valor. Al confirmar se crea el cobro y el servicio pasa a Pendiente de pago.
 */
export function QuoteOptions({
  serviceId,
  quote,
  items,
  materials,
  onChosen,
}: {
  serviceId: string;
  quote: Tables<'service_quotes'>;
  items: Tables<'quote_items'>[];
  materials: Tables<'quote_materials'>[];
  onChosen: () => void;
}) {
  const [selected, setSelected] = useState<Mode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError, errorSeq] = useErrorState();

  const totals: Record<Mode, number | null> = {
    labor_only: quote.total_labor_only != null ? Number(quote.total_labor_only) : null,
    all_inclusive: quote.total_all_inclusive != null ? Number(quote.total_all_inclusive) : null,
  };
  const options = pricingModes.filter((o) => totals[o.value] != null);
  // Tarifa de servicio incluida en cada opción: total de la opción − mano de obra − materiales.
  const labor = Number(quote.approved_labor_total ?? quote.labor_total);
  const fees: Record<Mode, number | null> = {
    labor_only: totals.labor_only != null ? totals.labor_only - labor : null,
    all_inclusive: totals.all_inclusive != null ? totals.all_inclusive - labor - Number(quote.materials_total ?? 0) : null,
  };
  const chosen = options.find((o) => o.value === selected) ?? null;

  const confirm = async () => {
    if (!selected) return;
    setError(null);
    setSaving(true);
    const { error: rpcError } = await supabase.rpc('choose_pricing_mode', { p_service_id: serviceId, p_mode: selected });
    setSaving(false);
    if (rpcError) return setError(`No pudimos guardar tu elección: ${rpcError.message}`);
    onChosen();
  };

  return (
    <View style={styles.container}>
      <View style={styles.block}>
        <View style={styles.laborRow}>
          <Text style={styles.label}>Mano de obra del experto</Text>
          <Text style={styles.laborValue}>{formatCOP(quote.approved_labor_total ?? quote.labor_total)}</Text>
        </View>
        {quote.estimated_days ? (
          <Text style={styles.meta}>
            Duración estimada: {quote.estimated_days} {quote.estimated_days === 1 ? 'día hábil' : 'días hábiles'}
          </Text>
        ) : null}
        {items.map((item, idx) => (
          <Text key={item.id} style={styles.line}>
            {idx + 1}. {item.description}
            <Text style={styles.lineMeta}>{[item.measurement, `${qty(item.quantity)} ${item.unit}`].filter(Boolean).map((t) => ` · ${t}`).join('')}</Text>
          </Text>
        ))}
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Materiales que necesita el trabajo</Text>
        {materials.length === 0 ? <Text style={styles.muted}>Sin materiales listados.</Text> : null}
        {materials.map((m) => (
          <View key={m.id} style={styles.material}>
            <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
            <Text style={styles.materialText}>
              {m.name}
              <Text style={styles.lineMeta}>
                {' · '}
                {qty(m.quantity)} {m.unit}
                {m.notes ? ` · ${m.notes}` : ''}
              </Text>
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.question}>¿Cómo quieres el servicio?</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              aria-checked={isSelected}
              onPress={() => setSelected(option.value)}
              style={[styles.option, isSelected && styles.optionSelected]}>
              <Ionicons name={isSelected ? 'radio-button-on' : 'radio-button-off'} size={20} color={isSelected ? colors.primary : colors.textMuted} />
              <View style={styles.optionText}>
                <View style={styles.optionHead}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{option.label}</Text>
                  <Text style={styles.optionPrice}>{formatCOP(totals[option.value])}</Text>
                </View>
                <Text style={styles.optionDescription}>{option.clientDescription}</Text>
                {fees[option.value] ? (
                  <Text style={styles.optionFee}>Incluye tarifa de servicio Xpertos: {formatCOP(fees[option.value])}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ErrorBanner seq={errorSeq} message={error} />
      <Button
        title={chosen ? `Elegir ${chosen.short.toLowerCase()} · ${formatCOP(totals[chosen.value])}` : 'Elige una opción'}
        onPress={confirm}
        loading={saving}
        disabled={!chosen || saving}
      />
      <Text style={styles.hint}>
        La tarifa de servicio de Xpertos es un porcentaje del valor de cada opción. Al elegir te mostramos cómo pagar y el contrato para aceptarlo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  block: { gap: 6 },
  laborRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  label: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  laborValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { fontSize: 14, color: colors.text },
  optionFee: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  line: { fontSize: 14, color: colors.text, lineHeight: 20 },
  lineMeta: { fontSize: 13, color: colors.textMuted },
  muted: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  material: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  materialText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  question: { fontSize: 16, fontWeight: '800', color: colors.text },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft, borderWidth: 2 },
  optionText: { flex: 1, gap: 4 },
  optionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  optionLabel: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  optionLabelSelected: { color: colors.primary },
  optionPrice: { fontSize: 16, fontWeight: '800', color: colors.text },
  optionDescription: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
