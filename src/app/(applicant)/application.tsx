import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, KeyValue, SectionTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, InfoBanner, Loading, Screen } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { colors, spacing } from '@/constants/theme';
import type { Enums, Tables } from '@/lib/database.types';
import { formatDateTime } from '@/lib/format';
import {
  applicationStatus,
  availableDocumentKinds,
  documentKindLabel,
  missingDocumentKinds,
  nextDocumentKind,
} from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { safeFileName, signedUrl, timestamp, uploadFile } from '@/lib/upload';
import { useAuth } from '@/providers/auth';

type Application = Tables<'expert_applications'>;
type ApplicationDocument = Tables<'application_documents'>;

type FormState = {
  phone: string;
  city: string;
  categoryIds: string[];
  experienceYears: string;
  bio: string;
};

export default function ApplicationScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [categories, setCategories] = useState<Tables<'service_categories'>[]>([]);
  const [application, setApplication] = useState<Application | null | undefined>(undefined);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({
    phone: profile?.phone ?? '',
    city: profile?.city ?? '',
    categoryIds: [],
    experienceYears: '',
    bio: '',
  });
  const [docKind, setDocKind] = useState<Enums<'document_kind'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    supabase
      .from('service_categories')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    const email = session.user.email ?? '';
    // RLS permite ver la postulación por user_id o por email (caso landing → registro).
    const { data, error: queryError } = await supabase
      .from('expert_applications')
      .select('*')
      .or(`user_id.eq.${session.user.id},email.ilike.${email}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (queryError) {
      setError(`No pudimos consultar tu postulación: ${queryError.message}`);
      setApplication(null);
      return;
    }
    setError(null);
    setApplication(data);
    if (data) {
      // Postulación creada al registrarse (o desde la landing) sin datos: abrir el formulario directamente.
      if (data.category_ids.length === 0 && (data.status === 'pending' || data.status === 'needs_info')) setEditing(true);
      setForm({
        phone: data.phone ?? '',
        city: data.city ?? '',
        categoryIds: data.category_ids,
        experienceYears: data.experience_years?.toString() ?? '',
        bio: data.bio ?? '',
      });
      const { data: docs } = await supabase
        .from('application_documents')
        .select('*')
        .eq('application_id', data.id)
        .order('created_at');
      setDocuments(docs ?? []);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshProfile()]);
    setRefreshing(false);
  };

  const validate = (): string | null => {
    if (form.categoryIds.length === 0) return 'Selecciona al menos una categoría.';
    const years = Number(form.experienceYears);
    if (form.experienceYears === '' || Number.isNaN(years) || years < 0 || years > 60)
      return 'Indica tus años de experiencia (entre 0 y 60).';
    if (form.bio.trim().length < 20) return 'Cuéntanos un poco más sobre tu experiencia (mínimo 20 caracteres).';
    return null;
  };

  const submit = async () => {
    if (!session || !profile) return;
    setError(null);
    setNotice(null);
    const validation = validate();
    if (validation) return setError(validation);
    setSaving(true);
    const payload = {
      phone: form.phone.trim() || null,
      city: form.city.trim() || null,
      category_ids: form.categoryIds,
      experience_years: Number(form.experienceYears),
      bio: form.bio.trim(),
    };
    const result = application
      ? await supabase.from('expert_applications').update(payload).eq('id', application.id)
      : await supabase.from('expert_applications').insert({
          ...payload,
          user_id: session.user.id,
          full_name: profile.full_name,
          email: profile.email ?? session.user.email ?? '',
        });
    setSaving(false);
    if (result.error) {
      setError(`No pudimos guardar la postulación: ${result.error.message}`);
      return;
    }
    setEditing(false);
    setNotice(application ? 'Postulación actualizada.' : '¡Postulación enviada! Ahora sube tus documentos.');
    await load();
  };

  // Los tipos únicos ya cargados salen del listado; si la selección dejó de estar disponible
  // (p. ej. recién cargada), se sugiere el siguiente tipo pendiente.
  const uploadedKinds = documents.map((d) => d.kind);
  const kindOptions = availableDocumentKinds(uploadedKinds).map((k) => ({
    value: k.value,
    label: k.label,
    badge: k.required ? 'Requerido' : undefined,
  }));
  const selectedKind =
    docKind && kindOptions.some((k) => k.value === docKind) ? docKind : nextDocumentKind(uploadedKinds, null);
  const missingKinds = missingDocumentKinds(uploadedKinds);

  const pickDocument = async () => {
    if (!session || !application) return;
    setError(null);
    const kind = selectedKind;
    if (!kind) return setError('Selecciona el tipo de documento antes de adjuntarlo.');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const path = `${session.user.id}/${application.id}/${timestamp()}-${safeFileName(asset.name)}`;
      await uploadFile('expert-documents', path, { uri: asset.uri, mimeType: asset.mimeType, name: asset.name });
      const { error: insertError } = await supabase.from('application_documents').insert({
        application_id: application.id,
        kind,
        storage_path: path,
        file_name: asset.name,
        mime_type: asset.mimeType ?? null,
      });
      if (insertError) throw new Error(insertError.message);
      setDocKind(nextDocumentKind([...uploadedKinds, kind], kind));
      setNotice(`${documentKindLabel(kind)}: documento agregado.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el documento.');
    } finally {
      setUploading(false);
    }
  };

  const openDocument = async (doc: ApplicationDocument) => {
    const url = await signedUrl('expert-documents', doc.storage_path);
    if (!url) return setError('No pudimos abrir el documento.');
    Linking.openURL(url);
  };

  const removeDocument = async (doc: ApplicationDocument) => {
    setError(null);
    const { error: deleteError } = await supabase.from('application_documents').delete().eq('id', doc.id);
    if (deleteError) return setError(`No se pudo eliminar: ${deleteError.message}`);
    await supabase.storage.from('expert-documents').remove([doc.storage_path]);
    await load();
  };

  if (application === undefined) return <Loading />;

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const canEdit = !application || application.status === 'pending' || application.status === 'needs_info';
  const showForm = !application || editing;

  return (
    <Screen
      title="Mi postulación"
      subtitle="Completa tu información y sube tus documentos"
      refreshing={refreshing}
      onRefresh={refresh}
      withTabs>
      <ErrorBanner message={error} />
      {notice ? <InfoBanner tone="success" message={notice} /> : null}

      {application && !showForm ? (
        <>
          <Card style={styles.card}>
            <View style={styles.statusRow}>
              <Text style={styles.cardTitle}>Tu postulación</Text>
              <Badge label={applicationStatus[application.status].label} tone={applicationStatus[application.status].tone} />
            </View>
            {application.status === 'approved' ? (
              <InfoBanner
                tone="success"
                message="¡Ya eres experto! Toca «Actualizar mi panel» para ver tus servicios asignados."
              />
            ) : application.status === 'rejected' ? (
              <InfoBanner tone="warning" message="Tu postulación no fue aprobada en esta ocasión." />
            ) : application.status === 'needs_info' ? (
              <InfoBanner tone="warning" message="Necesitamos más información. Revisa las notas y actualiza tu postulación o documentos." />
            ) : (
              <InfoBanner message="Estamos revisando tu postulación. Mientras tanto, asegúrate de subir tus documentos." />
            )}
            {application.admin_notes ? <KeyValue label="Notas del operador" value={application.admin_notes} /> : null}
            <KeyValue
              label="Categorías"
              value={categories
                .filter((c) => application.category_ids.includes(c.id))
                .map((c) => c.name)
                .join(', ')}
            />
            <KeyValue label="Experiencia" value={application.experience_years != null ? `${application.experience_years} años` : null} />
            <KeyValue label="Reseña" value={application.bio} />
            <KeyValue label="Enviada" value={formatDateTime(application.created_at)} />
            {application.status === 'approved' ? (
              <Button title="Actualizar mi panel" variant="outline" size="sm" onPress={refreshProfile} />
            ) : canEdit ? (
              <Button title="Editar postulación" variant="outline" size="sm" onPress={() => setEditing(true)} />
            ) : null}
          </Card>

          <SectionTitle>Documentos</SectionTitle>
          <Card style={styles.card}>
            <Text style={styles.help}>
              Requeridos: cédula por ambos lados, planilla de seguridad social y ARL, foto 3x4 con fondo blanco y carta de recomendación de tu último trabajo. Opcionales: RUT, antecedentes, certificados y portafolio (imagen o PDF, máx. 10 MB).
            </Text>
            {documents.length === 0 ? (
              <Text style={styles.muted}>Aún no has subido documentos.</Text>
            ) : (
              documents.map((doc) => (
                <View key={doc.id} style={styles.docRow}>
                  <Ionicons
                    name={doc.mime_type === 'application/pdf' ? 'document-text-outline' : 'image-outline'}
                    size={22}
                    color={colors.primary}
                  />
                  <Pressable accessibilityRole="link" style={styles.docInfo} onPress={() => openDocument(doc)}>
                    <Text style={styles.docKind}>{documentKindLabel(doc.kind)}</Text>
                    <Text style={styles.docName} numberOfLines={1}>
                      {doc.file_name}
                    </Text>
                  </Pressable>
                  {canEdit ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Eliminar documento" onPress={() => removeDocument(doc)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
            {canEdit ? (
              <>
                {missingKinds.length > 0 ? (
                  <Text style={styles.help}>
                    <Text style={styles.pendingLabel}>Requeridos pendientes: </Text>
                    {missingKinds.map((k) => k.label).join(', ')}.
                  </Text>
                ) : (
                  <InfoBanner
                    tone="success"
                    message="Ya cargaste todos los documentos requeridos. Puedes agregar documentos opcionales como RUT, certificados o portafolio."
                  />
                )}
                <Select
                  label="Tipo de documento"
                  options={kindOptions}
                  value={selectedKind}
                  onChange={setDocKind}
                  placeholder="Selecciona el tipo"
                />
                <Button title="Agregar documento" variant="outline" onPress={pickDocument} loading={uploading} />
              </>
            ) : null}
          </Card>
        </>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{application && application.category_ids.length > 0 ? 'Editar postulación' : 'Cuéntanos sobre ti'}</Text>
          {!application || application.category_ids.length === 0 ? (
            <Text style={styles.help}>
              Un operador de Xpertos revisará tu información y tus documentos. Si te aprueban, podrás recibir servicios asignados.
            </Text>
          ) : null}
          <Input label="Teléfono" value={form.phone} onChangeText={(phone) => setForm((f) => ({ ...f, phone }))} keyboardType="phone-pad" />
          <Input label="Ciudad" value={form.city} onChangeText={(city) => setForm((f) => ({ ...f, city }))} placeholder="Bogotá" />
          <Select
            label="Categorías en las que trabajas"
            multiple
            options={categoryOptions}
            value={form.categoryIds}
            onChange={(categoryIds) => setForm((f) => ({ ...f, categoryIds }))}
            placeholder="Selecciona una o varias"
          />
          <Input
            label="Años de experiencia"
            value={form.experienceYears}
            onChangeText={(experienceYears) => setForm((f) => ({ ...f, experienceYears: experienceYears.replace(/[^0-9]/g, '') }))}
            keyboardType="number-pad"
            placeholder="5"
          />
          <Input
            label="Reseña de tu experiencia"
            value={form.bio}
            onChangeText={(bio) => setForm((f) => ({ ...f, bio }))}
            multiline
            placeholder="Trabajos que has realizado, certificaciones, herramientas, etc."
          />
          <Button title={application ? 'Guardar cambios' : 'Enviar postulación'} onPress={submit} loading={saving} />
          {application && application.category_ids.length > 0 ? <Button title="Cancelar" variant="ghost" onPress={() => setEditing(false)} /> : null}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  muted: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  docInfo: { flex: 1 },
  docKind: { fontSize: 14, fontWeight: '600', color: colors.text },
  pendingLabel: { fontWeight: '600', color: colors.text },
  docName: { fontSize: 13, color: colors.textMuted },
});
