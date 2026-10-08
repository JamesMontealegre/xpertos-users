import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';
import { extensionForMime, timestamp, uploadFile, type LocalFile } from './upload';

/** Elige fotos de la galería (en web abre el selector de archivos). */
export async function pickImages(limit = 6): Promise<LocalFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.8,
  });
  if (result.canceled || !result.assets) return [];
  return result.assets.map((asset, idx) => ({
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    name: asset.fileName ?? `foto-${timestamp()}-${idx}.jpg`,
  }));
}

/** Toma una foto con la cámara (pide permiso). Devuelve null si se cancela o se niega el permiso. */
export async function takePhoto(): Promise<LocalFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos permiso para usar la cámara. Actívalo en los ajustes del teléfono.');
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? `foto-${timestamp()}.jpg` };
}

/** Sube una foto al bucket service-photos bajo `<folder>/` y devuelve la ruta. */
export async function uploadServicePhoto(folder: string, file: LocalFile, index = 0): Promise<string> {
  const mime = file.mimeType ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new Error('Solo se admiten fotos JPG, PNG o WebP.');
  }
  const path = `${folder}/${timestamp()}-${index}.${extensionForMime(mime, 'jpg')}`;
  await uploadFile('service-photos', path, { ...file, mimeType: mime });
  return path;
}

/** Borra un archivo de service-photos (si falla, el registro ya no lo referencia: no es crítico). */
export async function removeServicePhoto(path: string): Promise<void> {
  await supabase.storage.from('service-photos').remove([path]);
}
