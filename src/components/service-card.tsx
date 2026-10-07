import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { colors, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatDate } from '@/lib/format';
import { serviceStatus } from '@/lib/labels';

export type ServiceListItem = Tables<'services'> & {
  service_categories: { name: string } | null;
};

export function ServiceCard({ service }: { service: ServiceListItem }) {
  const status = serviceStatus[service.status];
  return (
    <Card onPress={() => router.push(`/service/${service.id}`)}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={2}>
          {service.title}
        </Text>
        <Badge label={status.label} tone={status.tone} />
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {service.description}
      </Text>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{service.service_categories?.name ?? 'Sin categoría'}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{formatDate(service.created_at)}</Text>
        </View>
        {service.city ? (
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>{service.city}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
