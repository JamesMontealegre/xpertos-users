import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ErrorBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums, Tables } from '@/lib/database.types';
import { formatCOP } from '@/lib/format';
import { presentedValues } from '@/lib/client-prices';
import { pricingModes, unitPriceLabel } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useFeedback } from '@/providers/feedback';

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
  clientFeePct,
  onChosen,
}: {
  serviceId: string;
  /** Tarifa de servicio del cliente (%): va incluida en los valores que se muestran. */
  clientFeePct: number;
  quote: Tables<'service_quotes'>;
  items: Tables<'quote_items'>[];
  materials: Tables<'quote_materials'>[];
  onChosen: () => void;
}) {
  const { confirm: ask, toast } = useFeedback();
  const [selected, setSelected] = useState<Mode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError, errorSeq] = useErrorState();

  const totals: Record<Mode, number | null> = {
    labor_only: quote.total_labor_only != null ? Number(quote.total_labor_only) : null,
    all_inclusive: quote.total_all_inclusive != null ? Number(quote.total_all_inclusive) : null,
  };
  const options = pricingModes.filter((o) => totals[o.value] != null);
  const shown = presentedValues(quote, materials, clientFeePct);
  const chosen = options.find((o) => o.value === selected) ?? null;

  const confirm = async () => {
    if (!selected || !chosen) return;
    const ok = await ask({
      title: `Elegir ${chosen.short.toLowerCase()}`,
      message: `El valor del servicio será ${formatCOP(totals[chosen.value])}. Después te mostramos cómo pagar y el contrato para aceptarlo.`,
      confirmLabel: 'Elegir esta opción',
    });
    if (!ok) return;
    setError(null);
    setSaving(true);
    const { error: rpcError } = await supabase.rpc('choose_pricing_mode', { p_service_id: serviceId, p_mode: selected });
    setSaving(false);
    if (rpcError) return setError(`No pudimos guardar tu elección: ${rpcError.message}`);
    toast(`Elegiste ${chosen.short.toLowerCase()}. Ya puedes pagar tu servicio.`, 'success');
    onChosen();
  };

  return (
    <View style={styles.container}>
      <View style={styles.block}>
        <View style={styles.laborRow}>
          <Text style={styles.label}>Mano de obra</Text>
          <Text style={styles.laborValue}>{formatCOP(shown.labor)}</Text>
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
                {shown.lines.get(m.id)?.unitPrice != null ? ` · ${formatCOP(shown.lines.get(m.id)?.unitPrice)} ${unitPriceLabel(m.unit)}` : ''}
                {m.notes ? ` · ${m.notes}` : ''}
              </Text>
            </Text>
            {shown.lines.get(m.id)?.lineTotal != null ? <Text style={styles.materialPrice}>{formatCOP(shown.lines.get(m.id)?.lineTotal)}</Text> : null}
          </View>
        ))}
        {shown.materialsTotal != null ? (
          <View style={styles.laborRow}>
            <Text style={styles.materialsTotalLabel}>Valor de los materiales (opción todo incluido)</Text>
            <Text style={styles.materialPrice}>{formatCOP(shown.materialsTotal)}</Text>
          </View>
        ) : null}
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
        Al elegir te mostramos cómo pagar y el contrato para aceptarlo.
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
  line: { fontSize: 14, color: colors.text, lineHeight: 20 },
  lineMeta: { fontSize: 13, color: colors.textMuted },
  muted: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  material: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  materialText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  materialPrice: { fontSize: 14, fontWeight: '700', color: colors.text },
  materialsTotalLabel: { flex: 1, fontSize: 13, color: colors.textMuted },
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
