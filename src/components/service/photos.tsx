import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text } from 'react-native';

import { Card, SectionTitle } from '@/components/ui/card';
import { colors, radius, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { signedUrl } from '@/lib/upload';

export function ServicePhotos({ photos }: { photos: Tables<'service_photos'>[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    Promise.all(photos.map(async (p) => [p.id, await signedUrl('service-photos', p.storage_path)] as const)).then((pairs) => {
      if (!active) return;
      const next: Record<string, string> = {};
      for (const [id, url] of pairs) if (url) next[id] = url;
      setUrls(next);
    });
    return () => {
      active = false;
    };
  }, [photos]);

  if (photos.length === 0) return null;

  return (
    <>
      <SectionTitle>Fotos</SectionTitle>
      <Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {photos.map((photo) =>
            urls[photo.id] ? (
              <Image key={photo.id} source={{ uri: urls[photo.id] }} style={styles.photo} accessibilityLabel="Foto del servicio" />
            ) : (
              <Text key={photo.id} style={styles.placeholder}>
                Cargando…
              </Text>
            )
          )}
        </ScrollView>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  photo: { width: 140, height: 140, borderRadius: radius, backgroundColor: colors.slateSoft },
  placeholder: {
    width: 140,
    height: 140,
    borderRadius: radius,
    backgroundColor: colors.slateSoft,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: colors.textMuted,
  },
});
