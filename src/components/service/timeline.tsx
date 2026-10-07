import { StyleSheet, Text, View } from 'react-native';

import { Card, SectionTitle } from '@/components/ui/card';
import { colors, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatDateTime } from '@/lib/format';
import { eventLabels, serviceStatus } from '@/lib/labels';

function describe(event: Tables<'service_events'>): string {
  if (event.type === 'status_change' && event.from_status && event.to_status) {
    return `${serviceStatus[event.from_status].label} → ${serviceStatus[event.to_status].label}`;
  }
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  if (event.type === 'contract_signed' && typeof payload.signer_role === 'string') {
    return payload.signer_role === 'client' ? 'Firmó el cliente' : 'Firmó el experto';
  }
  if (event.type === 'review_created' && typeof payload.rating === 'number') {
    return `${payload.rating} de 5 estrellas`;
  }
  if (event.type === 'assigned' && typeof payload.stages === 'number') {
    return `${payload.stages} ${payload.stages === 1 ? 'etapa de pago' : 'etapas de pago'}`;
  }
  return '';
}

export function Timeline({ events }: { events: Tables<'service_events'>[] }) {
  return (
    <>
      <SectionTitle>Línea de tiempo</SectionTitle>
      <Card>
        {events.length === 0 ? (
          <Text style={styles.muted}>Sin eventos todavía.</Text>
        ) : (
          events.map((event, idx) => {
            const detail = describe(event);
            return (
              <View key={event.id} style={styles.item}>
                <View style={styles.rail}>
                  <View style={styles.dot} />
                  {idx < events.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.content}>
                  <Text style={styles.title}>{eventLabels[event.type] ?? event.type}</Text>
                  {detail ? <Text style={styles.detail}>{detail}</Text> : null}
                  <Text style={styles.date}>{formatDateTime(event.created_at)}</Text>
                </View>
              </View>
            );
          })
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontStyle: 'italic', fontSize: 14 },
  item: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 5 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  content: { flex: 1, paddingBottom: spacing.md, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  detail: { fontSize: 13, color: colors.text },
  date: { fontSize: 12, color: colors.textMuted },
});
