import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DateInput, TimeInput } from '@/components/ui/masked-input';
import { ErrorBanner, InfoBanner, Screen, useErrorState } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatPlainDate, isValidDate, isValidTime } from '@/lib/format';
import { completeTime } from '@/lib/masks';
import { supabase } from '@/lib/supabase';
import { extensionForMime, timestamp, uploadFile } from '@/lib/upload';
import { useAuth } from '@/providers/auth';
import { useFeedback } from '@/providers/feedback';

type Slot = { date: string; from: string; to: string };
type Photo = { uri: string; mimeType: string; name: string };

const emptyForm = {
  categoryId: null as string | null,
  title: '',
  description: '',
  address: '',
  city: '',
};

export default function NewServiceScreen() {
  const { session, profile } = useAuth();
  const [categories, setCategories] = useState<Tables<'service_categories'>[]>([]);
  const [form, setForm] = useState({ ...emptyForm, city: profile?.city ?? '' });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotDraft, setSlotDraft] = useState<Slot>({ date: '', from: '', to: '' });
  const [slotError, setSlotError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError, errorSeq] = useErrorState();
  const { confirm, toast } = useFeedback();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('service_categories')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data, error: queryError }) => {
        if (queryError) setError(`No pudimos cargar las categorías: ${queryError.message}`);
        else setCategories(data ?? []);
      });
  }, [setError]);

  const addSlot = () => {
    setSlotError(null);
    // Por si se toca "Agregar franja" sin salir del campo de la hora ("8" → "08:00").
    const date = slotDraft.date;
    const from = completeTime(slotDraft.from);
    const to = completeTime(slotDraft.to);
    if (!isValidDate(date)) return setSlotError('La fecha debe tener el formato AAAA-MM-DD (p. ej. 2026-10-20).');
    if (!isValidTime(from) || !isValidTime(to)) return setSlotError('Las horas deben tener el formato HH:mm (p. ej. 08:00).');
    if (from >= to) return setSlotError('La hora final debe ser posterior a la inicial.');
    setSlots((prev) => [...prev, { date, from, to }]);
    setSlotDraft({ date: '', from: '', to: '' });
  };

  const pickPhotos = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6,
    });
    if (result.canceled) return;
    const picked: Photo[] = result.assets.map((asset, idx) => ({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? `foto-${timestamp()}-${idx}.jpg`,
    }));
    setPhotos((prev) => [...prev, ...picked].slice(0, 6));
  };

  const submit = async () => {
    if (!session) return;
    setError(null);
    if (!form.categoryId) return setError('Selecciona una categoría.');
    if (form.title.trim().length < 4) return setError('Escribe un título descriptivo (mínimo 4 caracteres).');
    if (form.description.trim().length < 10) return setError('Describe tu necesidad con más detalle (mínimo 10 caracteres).');
    if (slots.length === 0) return setError('Agrega al menos una franja de disponibilidad.');
    const category = categories.find((c) => c.id === form.categoryId);
    const ok = await confirm({
      title: 'Enviar solicitud',
      message: `${category ? `${category.name} · ` : ''}${form.title.trim()}. Xpertos te asignará un experto y te avisará.`,
      confirmLabel: 'Enviar solicitud',
    });
    if (!ok) return;

    setSaving(true);
    try {
      setProgress('Creando la solicitud…');
      const { data: service, error: insertError } = await supabase
        .from('services')
        .insert({
          client_id: session.user.id,
          category_id: form.categoryId,
          title: form.title.trim(),
          description: form.description.trim(),
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          availability: slots,
          status: 'requested',
        })
        .select('id')
        .single();
      if (insertError || !service) throw new Error(insertError?.message ?? 'No se pudo crear el servicio');

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        setProgress(`Subiendo foto ${i + 1} de ${photos.length}…`);
        const ext = extensionForMime(photo.mimeType, 'jpg');
        const path = `${session.user.id}/${service.id}/${timestamp()}-${i}.${ext}`;
        await uploadFile('service-photos', path, photo);
        const { error: photoError } = await supabase
          .from('service_photos')
          .insert({ service_id: service.id, storage_path: path, uploaded_by: session.user.id });
        if (photoError) throw new Error(`La foto se subió pero no se pudo registrar: ${photoError.message}`);
      }

      setForm({ ...emptyForm, city: profile?.city ?? '' });
      setSlots([]);
      setPhotos([]);
      toast('¡Solicitud enviada! Te avisaremos cuando asignemos un experto.', 'success');
      router.replace(`/service/${service.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error al guardar.');
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name, description: c.description ?? undefined }));

  return (
    <Screen title="Nuevo servicio" subtitle="Cuéntanos qué necesitas y cuándo puedes recibir al experto" withTabs>
      <ErrorBanner seq={errorSeq} message={error} />
      {progress ? <InfoBanner message={progress} /> : null}

      <Card style={styles.card}>
        <Select
          label="Categoría"
          placeholder="¿Qué tipo de servicio necesitas?"
          options={categoryOptions}
          value={form.categoryId}
          onChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}
        />
        <Input
          label="Título"
          placeholder="Ej. Fuga debajo del lavaplatos"
          value={form.title}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
        />
        <Input
          label="Descripción"
          placeholder="Describe el problema, el espacio y cualquier detalle útil"
          value={form.description}
          onChangeText={(description) => setForm((f) => ({ ...f, description }))}
          multiline
        />
        <Input
          label="Dirección"
          placeholder="Calle 100 # 15-20, Apto 501"
          value={form.address}
          onChangeText={(address) => setForm((f) => ({ ...f, address }))}
        />
        <Input label="Ciudad" placeholder="Bogotá" value={form.city} onChangeText={(city) => setForm((f) => ({ ...f, city }))} />
      </Card>

      <SectionTitle>Disponibilidad</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.help}>Agrega los días y horas en que puedes recibir al experto.</Text>
        {slots.map((slot, idx) => (
          <View key={`${slot.date}-${slot.from}-${idx}`} style={styles.slotRow}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={styles.slotText}>
              {formatPlainDate(slot.date)} · {slot.from} – {slot.to}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Eliminar franja"
              onPress={() => setSlots((prev) => prev.filter((_, i) => i !== idx))}
              hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        <View style={styles.slotInputs}>
          <DateInput
            label="Fecha"
            value={slotDraft.date}
            onChangeText={(date) => setSlotDraft((s) => ({ ...s, date }))}
            containerStyle={styles.slotDate}
          />
          <TimeInput
            label="Desde"
            placeholder="08:00"
            value={slotDraft.from}
            onChangeText={(from) => setSlotDraft((s) => ({ ...s, from }))}
            containerStyle={styles.slotTime}
          />
          <TimeInput
            label="Hasta"
            placeholder="12:00"
            value={slotDraft.to}
            onChangeText={(to) => setSlotDraft((s) => ({ ...s, to }))}
            containerStyle={styles.slotTime}
          />
        </View>
        {slotError ? <Text style={styles.slotError}>{slotError}</Text> : null}
        <Button title="Agregar franja" variant="outline" size="sm" onPress={addSlot} />
      </Card>

      <SectionTitle>Fotos (opcional)</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.help}>Las fotos ayudan al experto a entender el trabajo. Máximo 6.</Text>
        {photos.length > 0 ? (
          <View style={styles.photoGrid}>
            {photos.map((photo, idx) => (
              <View key={photo.uri + idx} style={styles.photoWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar foto"
                  onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                  style={styles.photoRemove}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <Button title="Elegir fotos" variant="outline" size="sm" onPress={pickPhotos} disabled={photos.length >= 6} />
      </Card>

      <Button title="Enviar solicitud" onPress={submit} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  slotText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  slotInputs: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  slotDate: { flexGrow: 2, flexBasis: 150 },
  slotTime: { flexGrow: 1, flexBasis: 90 },
  slotError: { color: colors.danger, fontSize: 13 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoWrap: { position: 'relative' },
  photo: { width: 96, height: 96, borderRadius: radius, backgroundColor: colors.slateSoft },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
