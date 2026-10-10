import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
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
  const approved = quote.status === 'approved';
  // Presentada al cliente con dos opciones: aún no elige (no hay total).
  const choosing = approved && quote.total == null;
  const allInclusive = approved && !choosing && quote.pricing_mode === 'all_inclusive';
  const labor = approved ? Number(quote.approved_labor_total ?? quote.labor_total) : Number(quote.labor_total || items.reduce((s, i) => s + Number(i.line_total ?? 0), 0));
  const materialsTotal = allInclusive ? Number(quote.materials_total ?? 0) : 0;
  const clientFee = Number(quote.client_fee_total ?? 0);
  const total = approved ? Number(quote.total ?? labor + clientFee + materialsTotal) : labor + materialsTotal;
  // El experto cobra su mano de obra menos la comisión; los materiales (todo incluido) los compra Xpertos.
  const net = commissionPct != null ? Math.round(labor * (1 - commissionPct / 100)) : null;
  const status = quoteStatus[quote.status];

  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        <View style={styles.modeChip}>
          <Text style={styles.modeText}>
            {approved && !choosing ? pricingModeLabel(quote.pricing_mode) : choosing ? 'El cliente está eligiendo la modalidad' : 'Modalidad: la elige el cliente'}
          </Text>
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

      <Text style={styles.label}>
        Materiales{' '}
        {approved && !choosing ? (allInclusive ? '(Xpertos los compra y los lleva al lugar)' : '(los compra el cliente)') : '(el cliente decide)'}
      </Text>
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

      {audience === 'expert' ? (
        // El experto ve su cotización, la comisión por uso de la app y lo que recibe; no el total del cliente.
        <View style={styles.totals}>
          <TotalRow label={approved ? 'Tu cotización (mano de obra aprobada)' : 'Tu cotización (mano de obra)'} value={formatCOP(labor)} />
          {net != null ? (
            <>
              <TotalRow label={`Comisión uso de la app (${qty(commissionPct ?? 0)} %)`} value={`− ${formatCOP(labor - net)}`} />
              <TotalRow label="Recibirás al finalizar el servicio" value={formatCOP(net)} strong />
            </>
          ) : null}
          {approved && quote.approved_labor_total != null && Number(quote.approved_labor_total) !== Number(quote.labor_total) ? (
            <Text style={styles.totalNote}>Cotizaste {formatCOP(quote.labor_total)}; Xpertos aprobó {formatCOP(quote.approved_labor_total)}.</Text>
          ) : null}
          <Text style={styles.totalNote}>Los materiales no hacen parte de tu pago.</Text>
        </View>
      ) : (
        <View style={styles.totals}>
          <TotalRow label={approved ? 'Mano de obra (aprobada)' : 'Mano de obra'} value={formatCOP(labor)} />
          {approved && clientFee > 0 ? <TotalRow label="Tarifa de servicio Xpertos" value={formatCOP(clientFee)} /> : null}
          {allInclusive ? <TotalRow label="Materiales" value={formatCOP(materialsTotal)} /> : null}
          {choosing ? (
            <>
              <TotalRow label="Opción solo mano de obra" value={formatCOP(quote.total_labor_only)} strong />
              {quote.total_all_inclusive != null ? (
                <TotalRow label="Opción todo incluido" value={formatCOP(quote.total_all_inclusive)} strong />
              ) : null}
            </>
          ) : (
            <TotalRow label="Total a pagar" value={formatCOP(total)} strong />
          )}
        </View>
      )}
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
  totalNote: { fontSize: 12, color: colors.textMuted },
  totalStrong: { fontSize: 16, fontWeight: '800', color: colors.text },
});
