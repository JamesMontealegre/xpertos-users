import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export type Bucket = 'expert-documents' | 'service-photos' | 'payment-proofs' | 'signatures';

export type LocalFile = {
  uri: string;
  mimeType?: string | null;
  name?: string | null;
};

/**
 * Sube un archivo local a Storage. La ruta debe empezar por `<auth.uid()>/` para que RLS acepte el upload.
 * - Web: la URI (blob:/data:) se convierte en Blob con fetch.
 * - Nativo: se lee el archivo con expo-file-system y se envía como ArrayBuffer.
 */
export async function uploadFile(bucket: Bucket, path: string, file: LocalFile): Promise<string> {
  const contentType = file.mimeType || guessMimeType(file.name ?? file.uri);
  let body: Blob | ArrayBuffer;
  if (Platform.OS === 'web') {
    const res = await fetch(file.uri);
    body = await res.blob();
  } else {
    body = await new ExpoFile(file.uri).arrayBuffer();
  }

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new Error(`No se pudo subir el archivo: ${error.message}`);
  }
  return path;
}

/** URL firmada (buckets privados). Devuelve null si no hay acceso. */
export async function signedUrl(bucket: Bucket, path: string, expiresInSeconds = 60 * 60): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

export function guessMimeType(nameOrUri: string): string {
  const ext = extensionOf(nameOrUri);
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export function extensionOf(nameOrUri: string): string {
  const clean = nameOrUri.split('?')[0].split('#')[0];
  const idx = clean.lastIndexOf('.');
  if (idx === -1 || idx === clean.length - 1) return '';
  return clean.slice(idx + 1).toLowerCase();
}

export function extensionForMime(mime: string | null | undefined, fallback = 'bin'): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    default:
      return fallback;
  }
}

/** Limpia un nombre de archivo para usarlo en una ruta de Storage. */
export function safeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
}

/** Sufijo único para nombres de archivo (marca de tiempo en ms). */
export function timestamp(): number {
  return Date.now();
}
