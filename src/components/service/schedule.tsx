import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card, KeyValue } from '@/components/ui/card';
import { colors, radius, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatDateTime, formatPlainDate } from '@/lib/format';

type Props = {
  service: Tables<'services'>;
  schedule: Tables<'service_schedule'> | null;
};

function daysLabel(n: number | null | undefined): string {
  if (n == null) return 'Por definir';
  return `${n} ${n === 1 ? 'día hábil' : 'días hábiles'}`;
}

/** Regla de inicio según la modalidad: 2 días hábiles (solo mano de obra) o 5 (todo incluido). */
function ruleLabel(schedule: Tables<'service_schedule'> | null): string {
  const offset = schedule?.start_offset_days ?? 2;
  const mode = schedule?.pricing_mode === 'all_inclusive' ? 'todo incluido' : 'solo mano de obra';
  return `${offset} días para el inicio · ${mode}`;
}

/** Fechas del servicio: cuenta regresiva en Programado y fechas acordadas en adelante. */
export function ScheduleCard({ service, schedule }: Props) {
  const status = service.status;

  if (status === 'pending_payment') {
    return (
      <Card style={styles.card}>
        <View style={styles.titleRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Fechas</Text>
        </View>
        <Text style={styles.text}>
          La obra inicia {schedule?.start_offset_days ?? 2} días hábiles después de que Xpertos verifique el pago
          {schedule?.pricing_mode === 'all_inclusive' ? ' (tiempo para comprar los materiales).' : '.'}
        </Text>
        <View style={styles.ruleSoft}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.ruleSoftText}>{ruleLabel(schedule)}</Text>
        </View>
        <View style={styles.grid}>
          <KeyValue label="Duración estimada" value={daysLabel(schedule?.estimated_days)} />
        </View>
      </Card>
    );
  }

  if (status === 'scheduled') {
    const n = schedule?.business_days_to_start ?? null;
    const headline =
      n === null
        ? 'Fecha de inicio por confirmar'
        : n <= 0
          ? 'La obra inicia hoy'
          : n === 1
            ? 'Falta 1 día hábil para el inicio'
            : `Faltan ${n} días hábiles para el inicio`;
    return (
      <View style={styles.hero} accessibilityRole="summary">
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="hourglass-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{headline}</Text>
            {schedule?.start_date ? <Text style={styles.heroSubtitle}>Inicia el {formatPlainDate(schedule.start_date)}</Text> : null}
          </View>
        </View>
        <View style={styles.rule}>
          <Ionicons name="information-circle-outline" size={16} color="#FFFFFF" />
          <Text style={styles.ruleText}>{ruleLabel(schedule)}</Text>
        </View>
        <View style={styles.heroGrid}>
          <HeroValue label="Pago verificado" value={schedule?.payment_date ? formatPlainDate(schedule.payment_date) : '—'} />
          <HeroValue label="Duración estimada" value={daysLabel(schedule?.estimated_days)} />
          <HeroValue
            label="Terminación estimada"
            value={schedule?.estimated_end_date ? formatPlainDate(schedule.estimated_end_date) : '—'}
          />
        </View>
      </View>
    );
  }

  if (['in_progress', 'paused', 'under_review', 'completed'].includes(status)) {
    return (
      <Card style={styles.card}>
        <View style={styles.titleRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Fechas acordadas</Text>
        </View>
        <View style={styles.grid}>
          <View style={styles.cell}>
            <KeyValue label="Inicio" value={schedule?.start_date ? formatPlainDate(schedule.start_date) : '—'} />
          </View>
          <View style={styles.cell}>
            <KeyValue label="Duración estimada" value={daysLabel(schedule?.estimated_days)} />
          </View>
          <View style={styles.cell}>
            <KeyValue
              label="Terminación estimada"
              value={schedule?.estimated_end_date ? formatPlainDate(schedule.estimated_end_date) : '—'}
            />
          </View>
          {service.closed_at ? (
            <View style={styles.cell}>
              <KeyValue label="Trabajo cerrado" value={formatDateTime(service.closed_at)} />
            </View>
          ) : null}
          {status === 'under_review' && service.review_due_date ? (
            <View style={styles.cell}>
              <KeyValue label="Verificación hasta" value={formatPlainDate(service.review_due_date)} />
            </View>
          ) : null}
        </View>
      </Card>
    );
  }

  return null;
}

function HeroValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroCell}>
      <Text style={styles.heroLabel}>{label}</Text>
      <Text style={styles.heroValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { minWidth: 130, flexGrow: 1, flexBasis: 130 },
  hero: { backgroundColor: colors.primary, borderRadius: radius, padding: spacing.md, gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: { flex: 1, gap: 2 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', lineHeight: 26 },
  heroSubtitle: { fontSize: 14, color: colors.primarySoft, fontWeight: '600' },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ruleText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  ruleSoft: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ruleSoftText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  heroCell: {
    flexGrow: 1,
    flexBasis: 120,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: spacing.sm,
    gap: 2,
  },
  heroLabel: { fontSize: 11, color: colors.primarySoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  heroValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
});
