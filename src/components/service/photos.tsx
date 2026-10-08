import { StyleSheet } from 'react-native';

import { PhotoGrid } from '@/components/service/photo-grid';
import { Card, SectionTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';

/** Fotos del servicio: las de la solicitud del cliente y las del antes que toma el experto al cotizar. */
export function ServicePhotos({ photos }: { photos: Tables<'service_photos'>[] }) {
  const request = photos.filter((p) => p.kind !== 'before');
  const before = photos.filter((p) => p.kind === 'before');
  if (photos.length === 0) return null;

  return (
    <>
      <SectionTitle>Fotos</SectionTitle>
      <Card>
        {request.length > 0 ? (
          <>
            <Text style={styles.label}>De la solicitud</Text>
            <PhotoGrid photos={request} size={104} />
          </>
        ) : null}
        {before.length > 0 ? (
          <>
            <Text style={styles.label}>Del antes (tomadas por el experto)</Text>
            <PhotoGrid photos={before} size={104} />
          </>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
});
