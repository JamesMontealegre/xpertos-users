import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { colors, radius, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatCOP } from '@/lib/format';
import { pricingModeLabel, quoteStatus } from '@/lib/labels';

type Props = {
  quote: Tables<'service_quotes'>;
  items: Tables<'quote_items'>[];
  materials: Tables<'quote_materials'>[];
  /** El cliente ve actividades y totales aprobados, sin los precios unitarios del experto. */
  audience: 'client' | 'expert';
  commissionPct?: number;
  showStatus?: boolean;
};

function qty(value: number): string {
  return Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

/** Resumen de la cotización en solo lectura. */
export function QuoteSummary({ quote, items, materials, audience, commissionPct, showStatus }: Props) {
  const allInclusive = quote.pricing_mode === 'all_inclusive';
  const approved = quote.status === 'approved';
  const labor = approved ? Number(quote.approved_labor_total ?? quote.labor_total) : Number(quote.labor_total || items.reduce((s, i) => s + Number(i.line_total ?? 0), 0));
  const materialsTotal = allInclusive ? Number(quote.materials_total ?? 0) : 0;
  const total = approved ? Number(quote.total ?? labor + materialsTotal) : labor + materialsTotal;
  const net = commissionPct != null ? Math.round(labor * (1 - commissionPct / 100) + materialsTotal) : null;
  const status = quoteStatus[quote.status];

  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        <View style={styles.modeChip}>
          <Text style={styles.modeText}>{pricingModeLabel(quote.pricing_mode)}</Text>
        </View>
        {showStatus ? <Badge label={status.label} tone={status.tone} /> : null}
      </View>
      {quote.estimated_days ? (
        <Text style={styles.meta}>
          Duración estimada: {quote.estimated_days} {quote.estimated_days === 1 ? 'día hábil' : 'días hábiles'}
        </Text>
      ) : null}

      <Text style={styles.label}>Actividades</Text>
      {items.length === 0 ? <Text style={styles.muted}>Sin actividades.</Text> : null}
      {items.map((item, idx) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>
              {idx + 1}. {item.description}
            </Text>
            <Text style={styles.rowMeta}>
              {[item.measurement, `${qty(item.quantity)} ${item.unit}`, audience === 'expert' ? `× ${formatCOP(item.unit_price)}` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          {audience === 'expert' ? <Text style={styles.rowAmount}>{formatCOP(item.line_total)}</Text> : null}
        </View>
      ))}

      <Text style={styles.label}>Materiales {allInclusive ? '(los suministra el experto)' : '(los compra el cliente)'}</Text>
      {materials.length === 0 ? <Text style={styles.muted}>Sin materiales listados.</Text> : null}
      {materials.map((m) => (
        <View key={m.id} style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>{m.name}</Text>
            <Text style={styles.rowMeta}>
              {[`${qty(m.quantity)} ${m.unit}`, m.notes].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {audience === 'expert' && m.estimated_cost != null ? (
            <Text style={styles.rowAmountMuted}>≈ {formatCOP(m.estimated_cost)}</Text>
          ) : null}
        </View>
      ))}

      {quote.notes ? (
        <>
          <Text style={styles.label}>Notas del experto</Text>
          <Text style={styles.notes}>{quote.notes}</Text>
        </>
      ) : null}

      <View style={styles.totals}>
        <TotalRow label={approved ? 'Mano de obra (aprobada)' : 'Mano de obra'} value={formatCOP(labor)} />
        {allInclusive ? <TotalRow label="Materiales" value={approved ? formatCOP(materialsTotal) : 'Lo asigna Xpertos'} /> : null}
        <TotalRow label={audience === 'client' ? 'Total a pagar' : 'Total del servicio'} value={formatCOP(total)} strong />
        {audience === 'expert' && approved && net != null ? (
          <TotalRow label={`Valor neto estimado para ti (comisión ${qty(commissionPct ?? 0)} %)`} value={formatCOP(net)} />
        ) : null}
      </View>
    </View>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, strong && styles.totalStrong]}>{label}</Text>
      <Text style={[styles.totalValue, strong && styles.totalStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  modeChip: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 1 },
  modeText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  meta: { fontSize: 14, color: colors.text },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  muted: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 13, color: colors.textMuted },
  rowAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowAmountMuted: { fontSize: 13, color: colors.textMuted },
  notes: { fontSize: 14, color: colors.text, lineHeight: 20 },
  totals: { backgroundColor: colors.background, borderRadius: radius, padding: spacing.md, gap: 6, marginTop: spacing.xs },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  totalLabel: { flex: 1, fontSize: 14, color: colors.textMuted },
  totalValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  totalStrong: { fontSize: 16, fontWeight: '800', color: colors.text },
});
