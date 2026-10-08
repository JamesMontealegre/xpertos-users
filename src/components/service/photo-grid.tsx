import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { signedUrl } from '@/lib/upload';

export type PhotoItem = { id: string; storage_path: string };

type Props = {
  photos: PhotoItem[];
  /** Si se pasa, cada foto muestra un botón para quitarla. */
  onRemove?: (photo: PhotoItem) => void;
  size?: number;
  emptyText?: string;
};

/** Cuadrícula de fotos privadas de service-photos (URLs firmadas). Tocar una foto la abre. */
export function PhotoGrid({ photos, onRemove, size = 96, emptyText }: Props) {
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

  if (photos.length === 0) return emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null;

  return (
    <View style={styles.grid}>
      {photos.map((photo) => (
        <View key={photo.id} style={{ width: size, height: size }}>
          {urls[photo.id] ? (
            <Pressable accessibilityRole="imagebutton" accessibilityLabel="Ver foto" onPress={() => Linking.openURL(urls[photo.id])}>
              <Image source={{ uri: urls[photo.id] }} style={[styles.photo, { width: size, height: size }]} />
            </Pressable>
          ) : (
            <View style={[styles.photo, styles.loading, { width: size, height: size }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quitar foto"
              onPress={() => onRemove(photo)}
              hitSlop={6}
              style={styles.remove}>
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { borderRadius: radius, backgroundColor: colors.slateSoft },
  loading: { alignItems: 'center', justifyContent: 'center' },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
});
