import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, KeyValue, SectionTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, InfoBanner, Loading, NoticeBanner, Screen, useErrorState } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import type { Enums, Tables } from '@/lib/database.types';
import { daysUntil, formatDate, formatDateTime } from '@/lib/format';
import {
  applicationStatus,
  availableDocumentKinds,
  documentKindLabel,
  isValidNequi,
  missingDocumentKinds,
  nextDocumentKind,
  payoutMethodLabel,
  payoutMethods,
} from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { safeFileName, signedUrl, timestamp, uploadFile } from '@/lib/upload';
import { useAuth } from '@/providers/auth';
import { useNotifications } from '@/providers/notifications';

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
  const [error, setError, errorSeq] = useErrorState();
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nequiNumber, setNequiNumber] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const { subscribe } = useNotifications();

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
      setNequiNumber(data.payout_method === 'nequi' ? (data.payout_account ?? '') : '');
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
  }, [session, setError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Un mensaje del agente sobre la postulación (documento rechazado, aprobada, rechazada…) llega en
  // tiempo real: se recarga para mostrar el estado nuevo sin que el aspirante tenga que refrescar.
  useEffect(
    () =>
      subscribe((n) => {
        if (n.application_id) load();
      }),
    [subscribe, load]
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
  // (p. ej. recién cargada), se sugiere el siguiente tipo pendiente. Los requeridos dependen del
  // medio de pago: la certificación bancaria solo es requerida con cuenta bancaria.
  const payoutMethod = application?.payout_method ?? null;
  // Los documentos rechazados no cuentan: hay que subirlos de nuevo.
  const activeDocuments = documents.filter((d) => d.status !== 'rejected');
  const rejectedDocuments = documents.filter((d) => d.status === 'rejected');
  const uploadedKinds = activeDocuments.map((d) => d.kind);
  const kindOptions = availableDocumentKinds(uploadedKinds, payoutMethod).map((k) => ({
    value: k.value,
    label: k.label,
    badge: k.required ? 'Requerido' : undefined,
  }));
  const selectedKind =
    docKind && kindOptions.some((k) => k.value === docKind) ? docKind : nextDocumentKind(uploadedKinds, null, payoutMethod);
  const missingKinds = missingDocumentKinds(uploadedKinds, payoutMethod);
  const missingPayout = !payoutMethod
    ? 'Medio de pago'
    : payoutMethod === 'nequi' && !application?.payout_account
      ? 'Número Nequi'
      : null;
  const pendingLabels = [...(missingPayout ? [missingPayout] : []), ...missingKinds.map((k) => k.label)];

  const savePayout = async (method: Enums<'payout_method'>, account: string | null) => {
    if (!application) return;
    setError(null);
    setNotice(null);
    setSavingPayout(true);
    const { error: updateError } = await supabase
      .from('expert_applications')
      .update({ payout_method: method, payout_account: account })
      .eq('id', application.id);
    setSavingPayout(false);
    if (updateError) return setError(`No pudimos guardar tu medio de pago: ${updateError.message}`);
    setApplication({ ...application, payout_method: method, payout_account: account });
    setDocKind(null);
    setNotice(
      method === 'bank_account'
        ? 'Medio de pago guardado. Sube tu certificación bancaria: ahora es un documento requerido.'
        : method === 'nequi' && !account
          ? 'Medio de pago guardado. Escribe tu número Nequi.'
          : 'Medio de pago guardado.'
    );
  };

  const changePayoutMethod = (method: Enums<'payout_method'>) => {
    if (method === application?.payout_method) return;
    const account = method === 'nequi' && isValidNequi(nequiNumber) ? nequiNumber.replace(/\D/g, '') : null;
    savePayout(method, account);
  };

  const saveNequi = () => {
    if (!isValidNequi(nequiNumber)) return setError('El número Nequi debe ser un celular de 10 dígitos que empiece por 3.');
    savePayout('nequi', nequiNumber.replace(/\D/g, ''));
  };

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
      setDocKind(nextDocumentKind([...uploadedKinds, kind], kind, payoutMethod));
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

  const reapply = async () => {
    setError(null);
    setNotice(null);
    setReapplying(true);
    const { error: rpcError } = await supabase.rpc('reapply_application');
    setReapplying(false);
    if (rpcError) return setError(`No pudimos abrir una nueva postulación: ${rpcError.message}`);
    setDocKind(null);
    setNotice('Abrimos una nueva postulación con tus datos. Sube tus documentos en los próximos 15 días calendario.');
    await load();
  };

  if (application === undefined) return <Loading />;

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const canEdit = !application || application.status === 'pending' || application.status === 'needs_info';
  const daysLeft = daysUntil(application?.expires_at);
  const deadline = application
    ? `${formatDate(application.expires_at)} (${daysLeft === 0 ? 'vence hoy' : daysLeft === 1 ? 'queda 1 día' : `quedan ${daysLeft} días`})`
    : '';
  const showForm = !application || editing;

  return (
    <Screen
      title="Mi postulación"
      subtitle="Completa tu información y sube tus documentos"
      refreshing={refreshing}
      onRefresh={refresh}
      withTabs>
      <ErrorBanner seq={errorSeq} message={error} />
      <NoticeBanner message={notice} />

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
              <>
                <InfoBanner
                  tone="warning"
                  message="Tu postulación no fue aprobada. Cuando resuelvas el motivo, puedes presentar una nueva postulación."
                />
                {application.admin_notes ? <KeyValue label="Motivo" value={application.admin_notes} /> : null}
              </>
            ) : application.status === 'expired' ? (
              <InfoBanner
                tone="warning"
                message={`Tu postulación venció el ${formatDate(application.expires_at)}: no se completó en 15 días calendario. Puedes presentar una nueva.`}
              />
            ) : application.status === 'in_review' ? (
              <InfoBanner message="Recibimos todos tus documentos. Un agente de Xpertos está revisando tu postulación; te avisaremos por correo y en Notificaciones." />
            ) : (
              <InfoBanner
                tone="warning"
                message={`Tienes hasta el ${deadline} para subir todos los requisitos. Si no completas tu postulación en ese plazo, se revocará automáticamente.`}
              />
            )}
            {application.admin_notes && application.status !== 'rejected' ? (
              <KeyValue label="Notas del operador" value={application.admin_notes} />
            ) : null}
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
            ) : application.status === 'rejected' || application.status === 'expired' ? (
              <Button title="Presentar una nueva postulación" onPress={reapply} loading={reapplying} />
            ) : canEdit ? (
              <Button title="Editar postulación" variant="outline" size="sm" onPress={() => setEditing(true)} />
            ) : null}
          </Card>

          <SectionTitle>Documentos</SectionTitle>
          <Card style={styles.card}>
            <Text style={styles.help}>
              Requeridos: cédula por ambos lados, planilla de seguridad social y ARL, foto 3x4 con fondo blanco, carta de recomendación de tu último trabajo y, si eliges recibir tus pagos en cuenta bancaria, la certificación bancaria. Opcionales: RUT, antecedentes, certificados y portafolio (imagen o PDF, máx. 10 MB).
            </Text>
            <View style={styles.payoutBox}>
              {canEdit ? (
                <>
                  <Select
                    label="¿Cómo quieres recibir tus pagos?"
                    placeholder="Elige un medio de pago"
                    options={payoutMethods.map((m) => ({ value: m.value, label: m.label, description: m.description }))}
                    value={payoutMethod}
                    onChange={changePayoutMethod}
                    disabled={savingPayout}
                    error={!payoutMethod ? 'Requerido: elige cómo quieres recibir tus pagos.' : null}
                  />
                  {payoutMethod === 'nequi' ? (
                    <View style={styles.nequiRow}>
                      <Input
                        label="Número Nequi"
                        value={nequiNumber}
                        onChangeText={(v) => setNequiNumber(v.replace(/[^0-9 ]/g, ''))}
                        keyboardType="phone-pad"
                        placeholder="300 000 0000"
                        containerStyle={styles.nequiInput}
                        hint={application.payout_account ? `Guardado: ${application.payout_account}` : 'Requerido para pagarte por Nequi.'}
                      />
                      <Button
                        title="Guardar número"
                        variant="outline"
                        size="sm"
                        onPress={saveNequi}
                        loading={savingPayout}
                        disabled={nequiNumber.replace(/\D/g, '') === (application.payout_account ?? '')}
                      />
                    </View>
                  ) : null}
                  {payoutMethod === 'efecty' ? (
                    <InfoBanner message={`Te pagaremos en Puntos Efecty a nombre de ${application.full_name || 'ti'}, con tu número de cédula. Lleva tu documento para retirar.`} />
                  ) : null}
                  {payoutMethod === 'bank_account' ? (
                    <Text style={styles.help}>La cuenta debe estar a tu nombre. Sube la certificación bancaria en los documentos.</Text>
                  ) : null}
                </>
              ) : (
                <KeyValue
                  label="Medio de pago"
                  value={`${payoutMethodLabel(payoutMethod)}${application.payout_account ? ` · ${application.payout_account}` : ''}`}
                />
              )}
            </View>
            {activeDocuments.length === 0 ? (
              <Text style={styles.muted}>Aún no has subido documentos.</Text>
            ) : (
              activeDocuments.map((doc) => (
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
            {rejectedDocuments.length > 0 ? (
              <View style={styles.rejectedBox}>
                <Text style={styles.rejectedTitle}>Documentos rechazados</Text>
                {rejectedDocuments.map((doc) => (
                  <Pressable key={doc.id} accessibilityRole="link" style={styles.rejectedRow} onPress={() => openDocument(doc)}>
                    <View style={styles.rejectedHead}>
                      <Text style={styles.docKind}>{documentKindLabel(doc.kind)}</Text>
                      <Badge label="Rechazado" tone="red" />
                    </View>
                    {doc.rejection_reason ? <Text style={styles.rejectedReason}>Motivo: {doc.rejection_reason}</Text> : null}
                    <Text style={styles.docName} numberOfLines={1}>
                      {doc.file_name}
                    </Text>
                  </Pressable>
                ))}
                {canEdit ? <Text style={styles.help}>Súbelos de nuevo corrigiendo lo indicado.</Text> : null}
              </View>
            ) : null}
            {canEdit ? (
              <>
                {pendingLabels.length > 0 ? (
                  <Text style={styles.help}>
                    <Text style={styles.pendingLabel}>Requeridos pendientes: </Text>
                    {pendingLabels.join(', ')}.
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
  payoutBox: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  nequiRow: { gap: spacing.xs },
  rejectedBox: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: '#FFF7F7',
  },
  rejectedTitle: { fontSize: 13, fontWeight: '700', color: colors.danger, textTransform: 'uppercase', letterSpacing: 0.5 },
  rejectedRow: { gap: 2 },
  rejectedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rejectedReason: { fontSize: 14, lineHeight: 20, color: colors.text },
  nequiInput: { flexGrow: 1 },
});
