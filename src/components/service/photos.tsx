import { StyleSheet } from 'react-native';

import { PhotoGrid } from '@/components/service/photo-grid';
import { SectionBody, SectionTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';

/** Fotos del servicio: las de la solicitud del cliente y las del antes que toma el experto al cotizar. */
export function ServicePhotos({ photos, embedded }: { photos: Tables<'service_photos'>[]; embedded?: boolean }) {
  const request = photos.filter((p) => p.kind !== 'before');
  const before = photos.filter((p) => p.kind === 'before');
  if (photos.length === 0) return null;

  return (
    <>
      {embedded ? null : <SectionTitle>Fotos</SectionTitle>}
      <SectionBody plain={embedded}>
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
      </SectionBody>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
});
