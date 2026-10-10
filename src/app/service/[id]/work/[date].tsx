import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { PhotoGrid } from '@/components/service/photo-grid';
import type { WorkLog } from '@/components/service/work-logs';
import { Button } from '@/components/ui/button';
import { Card, KeyValue, SectionTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { TimeInput } from '@/components/ui/masked-input';
import { ErrorBanner, InfoBanner, Loading, NoticeBanner, Screen, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { capitalizeFirst, formatPlainDate, formatTime, isValidDate, isValidTime, nowTimeCO, todayCO } from '@/lib/format';
import { completeTime } from '@/lib/masks';
import { pickImages, removeServicePhoto, takePhoto, uploadServicePhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { LocalFile } from '@/lib/upload';
import { useAuth } from '@/providers/auth';

type Loaded = { service: Tables<'services'>; log: WorkLog | null };

/** Registro de una jornada: hora de ingreso, hora de salida, notas y fotos del trabajo. */
export default function WorkDayScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date: string }>();
  const { session } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError, errorSeq] = useErrorState();
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!session || !id || !date || !isValidDate(date)) {
      if (date && !isValidDate(date)) setNotFound(true);
      return;
    }
    const [{ data: service, error: serviceError }, { data: log }] = await Promise.all([
      supabase.from('services').select('*').eq('id', id).maybeSingle(),
      supabase.from('work_logs').select('*, work_log_photos(*)').eq('service_id', id).eq('work_date', date).maybeSingle(),
    ]);
    if (serviceError) return setError(`No pudimos cargar el servicio: ${serviceError.message}`);
    if (!service) return setNotFound(true);
    setLoaded({ service, log: log ?? null });
    setCheckIn(log?.check_in ? formatTime(log.check_in) : '');
    setCheckOut(log?.check_out ? formatTime(log.check_out) : '');
    setNotes(log?.notes ?? '');
  }, [session, id, date, setError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Recarga la jornada (fotos incluidas) sin tocar lo que se está escribiendo en el formulario. */
  const reloadLog = async () => {
    if (!id || !date) return;
    const { data: log } = await supabase.from('work_logs').select('*, work_log_photos(*)').eq('service_id', id).eq('work_date', date).maybeSingle();
    setLoaded((prev) => (prev ? { ...prev, log: log ?? null } : prev));
  };

  if (notFound) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Jornada no encontrada" />
      </Screen>
    );
  }
  if (!loaded || !session) {
    return (
      <Screen>
        <ErrorBanner seq={errorSeq} message={error} />
        {!error ? <Loading /> : null}
      </Screen>
    );
  }

  const { service, log } = loaded;
  const userId = session.user.id;
  const today = todayCO();
  const isExpert = service.expert_id === userId;
  const startDate = service.start_date;
  const inRange = date <= today && (!startDate || date >= startDate);
  const editable = isExpert && service.status === 'in_progress' && inRange;
  const isFirstDay = date === startDate;
  const isToday = date === today;
  const title = `Jornada · ${formatPlainDate(date)}`;

  /** Guarda (crea o actualiza) la jornada con los valores del formulario. */
  const saveLog = async (): Promise<WorkLog> => {
    // Por si se guarda sin salir del campo de la hora ("8" → "08:00").
    const checkInTime = completeTime(checkIn);
    const checkOutTime = completeTime(checkOut);
    if (checkInTime && !isValidTime(checkInTime)) throw new Error('La hora de ingreso debe tener el formato HH:MM (p. ej. 08:00).');
    if (checkOutTime && !isValidTime(checkOutTime)) throw new Error('La hora de salida debe tener el formato HH:MM (p. ej. 17:00).');
    if (checkOutTime && !checkInTime) throw new Error('Indica primero la hora de ingreso.');
    if (checkInTime && checkOutTime && checkOutTime <= checkInTime) throw new Error('La hora de salida debe ser posterior a la de ingreso.');
    const { data, error: upsertError } = await supabase
      .from('work_logs')
      .upsert(
        {
          service_id: service.id,
          expert_id: userId,
          work_date: date,
          check_in: checkInTime || null,
          check_out: checkOutTime || null,
          notes: notes.trim() || null,
        },
        { onConflict: 'service_id,work_date' }
      )
      .select('*, work_log_photos(*)')
      .single();
    if (upsertError || !data) throw new Error(upsertError?.message ?? 'No se pudo guardar la jornada.');
    return data;
  };

  const save = async () => {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await saveLog();
      setNotice('Jornada guardada.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la jornada.');
    } finally {
      setSaving(false);
    }
  };

  const addPhotos = async (source: 'library' | 'camera') => {
    setError(null);
    setNotice(null);
    try {
      const files: LocalFile[] = source === 'camera' ? [await takePhoto()].filter((f): f is LocalFile => f !== null) : await pickImages(6);
      if (files.length === 0) return;
      setUploading(true);
      // La foto se asocia a la jornada: si aún no existe, se crea con lo que haya en el formulario.
      const current = log ?? (await saveLog());
      for (const [idx, file] of files.entries()) {
        const path = await uploadServicePhoto(`${userId}/${service.id}/work/${date}`, file, idx);
        const { error: insertError } = await supabase.from('work_log_photos').insert({ log_id: current.id, storage_path: path });
        if (insertError) throw new Error(`La foto se subió pero no se pudo registrar: ${insertError.message}`);
      }
      setNotice(files.length === 1 ? 'Foto agregada.' : `${files.length} fotos agregadas.`);
      await reloadLog();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (photo: { id: string; storage_path: string }) => {
    setError(null);
    const { error: deleteError } = await supabase.from('work_log_photos').delete().eq('id', photo.id);
    if (deleteError) return setError(`No se pudo eliminar la foto: ${deleteError.message}`);
    await removeServicePhoto(photo.storage_path);
    await reloadLog();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Text style={styles.title}>{capitalizeFirst(formatPlainDate(date))}</Text>
      <View style={styles.tags}>
        {isToday ? <Text style={[styles.tag, styles.tagToday]}>Hoy</Text> : null}
        {isFirstDay ? <Text style={[styles.tag, styles.tagRequired]}>Obligatorio · primer día</Text> : null}
        {service.payout_frequency === 'daily' ? <Text style={[styles.tag, styles.tagRequired]}>Pago diario: jornada obligatoria</Text> : null}
      </View>
      <ErrorBanner seq={errorSeq} message={error} />
      <NoticeBanner message={notice} />
      {!editable ? (
        <InfoBanner
          tone="warning"
          message={
            !isExpert
              ? 'Registro del experto (solo lectura).'
              : service.status !== 'in_progress'
                ? 'El servicio no está en ejecución: la jornada queda en solo lectura.'
                : 'Solo puedes registrar jornadas desde la fecha de inicio hasta hoy.'
          }
        />
      ) : isToday ? (
        <InfoBanner message="Para cerrar el trabajo hoy necesitas el registro de hoy con hora de ingreso, hora de salida y fotos." />
      ) : null}

      <Card style={styles.card}>
        {editable ? (
          <>
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <TimeInput label="Hora de ingreso" value={checkIn} onChangeText={setCheckIn} placeholder="08:00" />
                <Button title="Ahora" variant="ghost" size="sm" onPress={() => setCheckIn(nowTimeCO())} />
              </View>
              <View style={styles.timeCol}>
                <TimeInput label="Hora de salida" value={checkOut} onChangeText={setCheckOut} placeholder="17:00" />
                <Button title="Ahora" variant="ghost" size="sm" onPress={() => setCheckOut(nowTimeCO())} />
              </View>
            </View>
            <Input label="Notas" value={notes} onChangeText={setNotes} multiline placeholder="Qué se hizo en esta jornada, novedades…" />
            <Button title="Guardar jornada" onPress={save} loading={saving} disabled={uploading} />
          </>
        ) : log ? (
          <>
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <KeyValue label="Hora de ingreso" value={log.check_in ? formatTime(log.check_in) : null} />
              </View>
              <View style={styles.timeCol}>
                <KeyValue label="Hora de salida" value={log.check_out ? formatTime(log.check_out) : null} />
              </View>
            </View>
            <KeyValue label="Notas" value={log.notes} />
          </>
        ) : (
          <Text style={styles.muted}>Sin registro para este día.</Text>
        )}
      </Card>

      <SectionTitle right={<Text style={styles.count}>{log?.work_log_photos.length ?? 0}</Text>}>Fotos del trabajo</SectionTitle>
      <Card style={styles.card}>
        <PhotoGrid
          photos={log?.work_log_photos ?? []}
          onRemove={editable ? removePhoto : undefined}
          emptyText="Aún no hay fotos de esta jornada."
        />
        {editable ? (
          <View style={styles.timeRow}>
            {Platform.OS !== 'web' ? (
              <Button title="Tomar foto" variant="outline" size="sm" onPress={() => addPhotos('camera')} loading={uploading} style={styles.flex} />
            ) : null}
            <Button
              title={Platform.OS === 'web' ? 'Agregar fotos' : 'Elegir de la galería'}
              variant="outline"
              size="sm"
              onPress={() => addPhotos('library')}
              loading={uploading}
              style={styles.flex}
            />
          </View>
        ) : null}
      </Card>

      <Button title="Volver al servicio" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  tagToday: { backgroundColor: colors.primarySoft, color: colors.primary },
  tagRequired: { backgroundColor: colors.dangerSoft, color: colors.danger },
  timeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  timeCol: { flexGrow: 1, flexBasis: 140, gap: 2 },
  flex: { flexGrow: 1, flexBasis: 140 },
  muted: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  count: { color: colors.textMuted, fontWeight: '700' },
});
