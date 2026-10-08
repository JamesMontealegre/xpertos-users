import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { PhotoGrid } from '@/components/service/photo-grid';
import { QuoteSummary } from '@/components/service/quote-summary';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ErrorBanner, InfoBanner, Loading, Screen } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Enums, Tables } from '@/lib/database.types';
import { formatCOP, parseMoney, parseQuantity, quantityToInput } from '@/lib/format';
import { activityUnits, materialUnits, pricingModes } from '@/lib/labels';
import { pickImages, removeServicePhoto, takePhoto, uploadServicePhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { LocalFile } from '@/lib/upload';
import { useAuth } from '@/providers/auth';

type ItemDraft = { key: string; description: string; measurement: string; quantity: string; unit: string; unitPrice: string };
type MaterialDraft = { key: string; name: string; quantity: string; unit: string; estimatedCost: string; notes: string };

type Loaded = {
  service: Tables<'services'>;
  quote: Tables<'service_quotes'> | null;
  items: Tables<'quote_items'>[];
  materials: Tables<'quote_materials'>[];
  photos: Tables<'service_photos'>[];
};

let keySeq = 0;
const newKey = () => `k${Date.now()}-${keySeq++}`;
const emptyItem = (): ItemDraft => ({ key: newKey(), description: '', measurement: '', quantity: '1', unit: 'und', unitPrice: '' });
const emptyMaterial = (): MaterialDraft => ({ key: newKey(), name: '', quantity: '1', unit: 'und', estimatedCost: '', notes: '' });

const isBlankItem = (i: ItemDraft) => !i.description.trim() && !i.measurement.trim() && !i.unitPrice.trim();
const isBlankMaterial = (m: MaterialDraft) => !m.name.trim() && !m.notes.trim() && !m.estimatedCost.trim();

function lineTotal(item: ItemDraft): number {
  const q = parseQuantity(item.quantity);
  const p = parseMoney(item.unitPrice);
  return Number.isFinite(q) && Number.isFinite(p) ? Math.round(q * p * 100) / 100 : 0;
}

/** Formulario de cotización del experto (servicio Asignado). Tras enviarla queda en solo lectura. */
export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<Enums<'pricing_mode'>>('labor_only');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!session || !id) return;
    const [{ data: service, error: serviceError }, { data: quote }, { data: photos }] = await Promise.all([
      supabase.from('services').select('*').eq('id', id).maybeSingle(),
      supabase.from('service_quotes').select('*, quote_items(*), quote_materials(*)').eq('service_id', id).maybeSingle(),
      supabase.from('service_photos').select('*').eq('service_id', id).eq('kind', 'before').order('created_at'),
    ]);
    if (serviceError) return setError(`No pudimos cargar el servicio: ${serviceError.message}`);
    if (!service) return setNotFound(true);

    const { quote_items: qItems, quote_materials: qMaterials, ...quoteRow } = quote ?? { quote_items: [], quote_materials: [] };
    const sortedItems = [...qItems].sort((a, b) => a.position - b.position);
    const sortedMaterials = [...qMaterials].sort((a, b) => a.position - b.position);
    setLoaded({
      service,
      quote: quote ? (quoteRow as Tables<'service_quotes'>) : null,
      items: sortedItems,
      materials: sortedMaterials,
      photos: photos ?? [],
    });
    if (quote) {
      setMode(quote.pricing_mode);
      setEstimatedDays(quote.estimated_days?.toString() ?? '');
      setNotes(quote.notes ?? '');
      setItems(
        sortedItems.length
          ? sortedItems.map((i) => ({
              key: i.id,
              description: i.description,
              measurement: i.measurement ?? '',
              quantity: quantityToInput(i.quantity),
              unit: i.unit,
              unitPrice: String(Math.round(Number(i.unit_price))),
            }))
          : [emptyItem()]
      );
      setMaterials(
        sortedMaterials.map((m) => ({
          key: m.id,
          name: m.name,
          quantity: quantityToInput(m.quantity),
          unit: m.unit,
          estimatedCost: m.estimated_cost != null ? String(Math.round(Number(m.estimated_cost))) : '',
          notes: m.notes ?? '',
        }))
      );
    }
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Recarga solo las fotos del antes, sin tocar lo que el experto está editando en el formulario. */
  const loadPhotos = async () => {
    if (!id) return;
    const { data: photos } = await supabase.from('service_photos').select('*').eq('service_id', id).eq('kind', 'before').order('created_at');
    setLoaded((prev) => (prev ? { ...prev, photos: photos ?? [] } : prev));
  };

  if (notFound) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Servicio no encontrado" description="Puede que no tengas acceso a este servicio." />
      </Screen>
    );
  }
  if (!loaded || !session) {
    return (
      <Screen>
        <ErrorBanner message={error} />
        {!error ? <Loading /> : null}
      </Screen>
    );
  }

  const { service, quote } = loaded;
  const userId = session.user.id;
  const isExpert = service.expert_id === userId;
  const editable = isExpert && service.status === 'assigned' && (!quote || quote.status === 'draft' || quote.status === 'returned');
  const allInclusive = mode === 'all_inclusive';
  const laborTotal = items.reduce((sum, i) => sum + lineTotal(i), 0);
  const materialsEstimate = materials.reduce((sum, m) => sum + (Number.isFinite(parseMoney(m.estimatedCost)) ? parseMoney(m.estimatedCost) : 0), 0);

  if (!isExpert) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Cotización' }} />
        <EmptyState icon="lock-closed-outline" title="Solo el experto asignado puede cotizar este servicio" />
      </Screen>
    );
  }

  // ---------- Solo lectura ----------
  if (!editable) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Cotización' }} />
        {quote?.status === 'submitted' || service.status === 'quoting' ? (
          <InfoBanner message="En cotización: Xpertos está revisando tu cotización. Si hay algo por corregir te la devolverán con las notas." />
        ) : quote?.status === 'approved' ? (
          <InfoBanner tone="success" message={`Xpertos aprobó tu cotización.${quote.admin_notes ? ` Notas: ${quote.admin_notes}` : ''}`} />
        ) : (
          <InfoBanner tone="warning" message="Este servicio no está disponible para cotizar." />
        )}
        {notice ? <InfoBanner tone="success" message={notice} /> : null}
        {quote ? (
          <Card style={styles.card}>
            <QuoteSummary
              quote={quote}
              items={loaded.items}
              materials={loaded.materials}
              audience="expert"
              commissionPct={Number(service.commission_pct)}
              showStatus
            />
          </Card>
        ) : null}
        {loaded.photos.length > 0 ? (
          <>
            <SectionTitle>Fotos del antes</SectionTitle>
            <Card>
              <PhotoGrid photos={loaded.photos} />
            </Card>
          </>
        ) : null}
        <Button title="Volver al servicio" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  // ---------- Edición ----------
  const updateItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const updateMaterial = (key: string, patch: Partial<MaterialDraft>) =>
    setMaterials((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  /** Valida y guarda el borrador (upsert de la cotización + reemplazo de actividades y materiales). */
  const persist = async (): Promise<void> => {
    const itemRows: { description: string; measurement: string | null; quantity: number; unit: string; unit_price: number }[] = [];
    for (const [idx, item] of items.entries()) {
      if (isBlankItem(item)) continue;
      const n = idx + 1;
      if (!item.description.trim()) throw new Error(`Actividad ${n}: escribe la descripción.`);
      const quantity = parseQuantity(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Actividad ${n}: la cantidad debe ser mayor a cero.`);
      const price = item.unitPrice.trim() ? parseMoney(item.unitPrice) : 0;
      itemRows.push({
        description: item.description.trim(),
        measurement: item.measurement.trim() || null,
        quantity,
        unit: item.unit,
        unit_price: price,
      });
    }
    const materialRows: { name: string; quantity: number; unit: string; estimated_cost: number | null; notes: string | null }[] = [];
    for (const [idx, m] of materials.entries()) {
      if (isBlankMaterial(m)) continue;
      const n = idx + 1;
      if (!m.name.trim()) throw new Error(`Material ${n}: escribe el nombre.`);
      const quantity = parseQuantity(m.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Material ${n}: la cantidad debe ser mayor a cero.`);
      materialRows.push({
        name: m.name.trim(),
        quantity,
        unit: m.unit,
        estimated_cost: m.estimatedCost.trim() ? parseMoney(m.estimatedCost) : null,
        notes: m.notes.trim() || null,
      });
    }
    let days: number | null = null;
    if (estimatedDays.trim()) {
      days = Number(estimatedDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('La duración estimada debe ser de 1 a 365 días hábiles.');
    }

    const fields = { pricing_mode: mode, estimated_days: days, notes: notes.trim() || null };
    let quoteId = quote?.id;
    if (!quoteId) {
      const { data, error: insertError } = await supabase
        .from('service_quotes')
        .insert({ ...fields, service_id: service.id, expert_id: userId, status: 'draft' })
        .select('id')
        .single();
      if (insertError || !data) throw new Error(insertError?.message ?? 'No se pudo crear la cotización.');
      quoteId = data.id;
    } else {
      const { error: updateError } = await supabase.from('service_quotes').update(fields).eq('id', quoteId);
      if (updateError) throw new Error(updateError.message);
    }

    const [{ error: delItemsError }, { error: delMaterialsError }] = await Promise.all([
      supabase.from('quote_items').delete().eq('quote_id', quoteId),
      supabase.from('quote_materials').delete().eq('quote_id', quoteId),
    ]);
    if (delItemsError || delMaterialsError) throw new Error((delItemsError ?? delMaterialsError)?.message);
    if (itemRows.length) {
      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(itemRows.map((row, idx) => ({ ...row, quote_id: quoteId, position: idx + 1 })));
      if (itemsError) throw new Error(`No se guardaron las actividades: ${itemsError.message}`);
    }
    if (materialRows.length) {
      const { error: materialsError } = await supabase
        .from('quote_materials')
        .insert(materialRows.map((row, idx) => ({ ...row, quote_id: quoteId, position: idx + 1 })));
      if (materialsError) throw new Error(`No se guardaron los materiales: ${materialsError.message}`);
    }
  };

  const saveDraft = async () => {
    setError(null);
    setNotice(null);
    setSaving('draft');
    try {
      await persist();
      setNotice('Borrador guardado. Puedes seguir editándolo antes de enviarlo.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la cotización.');
    } finally {
      setSaving(null);
    }
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    setSaving('submit');
    try {
      await persist();
      const { error: rpcError } = await supabase.rpc('submit_quote', { p_service_id: service.id });
      if (rpcError) {
        await load();
        throw new Error(`Se guardó el borrador, pero no se pudo enviar: ${rpcError.message}`);
      }
      setNotice('¡Cotización enviada! Xpertos la revisará y te avisará.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la cotización.');
    } finally {
      setSaving(null);
    }
  };

  const addPhotos = async (source: 'library' | 'camera') => {
    setError(null);
    try {
      const files: LocalFile[] = source === 'camera' ? [await takePhoto()].filter((f): f is LocalFile => f !== null) : await pickImages(6);
      if (files.length === 0) return;
      setUploading(true);
      for (const [idx, file] of files.entries()) {
        const path = await uploadServicePhoto(`${userId}/${service.id}/before`, file, idx);
        const { error: insertError } = await supabase
          .from('service_photos')
          .insert({ service_id: service.id, storage_path: path, uploaded_by: userId, kind: 'before' });
        if (insertError) throw new Error(`La foto se subió pero no se pudo registrar: ${insertError.message}`);
      }
      await loadPhotos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (photo: { id: string; storage_path: string }) => {
    setError(null);
    const { error: deleteError } = await supabase.from('service_photos').delete().eq('id', photo.id);
    if (deleteError) return setError(`No se pudo eliminar la foto: ${deleteError.message}`);
    await removeServicePhoto(photo.storage_path);
    await loadPhotos();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Cotización' }} />
      {quote?.status === 'returned' ? (
        <View style={styles.returned}>
          <Ionicons name="arrow-undo-outline" size={20} color={colors.warning} />
          <View style={styles.returnedText}>
            <Text style={styles.returnedTitle}>Xpertos devolvió tu cotización</Text>
            <Text style={styles.returnedNotes}>{quote.admin_notes || 'Revisa y vuelve a enviarla.'}</Text>
          </View>
        </View>
      ) : null}
      <Text style={styles.serviceTitle}>{service.title}</Text>
      <ErrorBanner message={error} />
      {notice ? <InfoBanner tone="success" message={notice} /> : null}

      <SectionTitle>Modalidad</SectionTitle>
      <View style={styles.modes} accessibilityRole="radiogroup">
        {pricingModes.map((option) => {
          const selected = mode === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              aria-checked={selected}
              onPress={() => setMode(option.value)}
              style={[styles.mode, selected && styles.modeSelected]}>
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.primary : colors.textMuted} />
              <View style={styles.modeText}>
                <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>{option.label}</Text>
                <Text style={styles.modeDescription}>{option.description}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.card}>
        <Input
          label="Duración estimada (días hábiles)"
          value={estimatedDays}
          onChangeText={(v) => setEstimatedDays(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          placeholder="3"
          hint="Días hábiles de trabajo, sin contar fines de semana ni festivos."
        />
      </Card>

      <SectionTitle right={<Text style={styles.sectionTotal}>{formatCOP(laborTotal)}</Text>}>Actividades</SectionTitle>
      {items.map((item, idx) => (
        <Card key={item.key} style={styles.card}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle}>Actividad {idx + 1}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eliminar actividad ${idx + 1}`}
              onPress={() => setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== item.key) : [emptyItem()]))}
              hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
          <Input
            label="Descripción"
            value={item.description}
            onChangeText={(description) => updateItem(item.key, { description })}
            placeholder="Ej. Cambio de sifón del lavaplatos"
          />
          <Input
            label="Medidas"
            value={item.measurement}
            onChangeText={(measurement) => updateItem(item.key, { measurement })}
            placeholder="Ej. 3 x 2,5 m"
          />
          <View style={styles.inline}>
            <Input
              label="Cantidad"
              value={item.quantity}
              onChangeText={(quantity) => updateItem(item.key, { quantity: quantity.replace(/[^0-9.,]/g, '') })}
              keyboardType="decimal-pad"
              containerStyle={styles.qty}
            />
            <Input
              label="Valor unitario"
              value={item.unitPrice}
              onChangeText={(unitPrice) => updateItem(item.key, { unitPrice: unitPrice.replace(/\D/g, '') })}
              keyboardType="number-pad"
              placeholder="0"
              containerStyle={styles.price}
            />
          </View>
          <Text style={styles.fieldLabel}>Unidad</Text>
          <View style={styles.chips}>
            {activityUnits.map((unit) => (
              <Pressable
                key={unit}
                accessibilityRole="radio"
                aria-checked={item.unit === unit}
                onPress={() => updateItem(item.key, { unit })}
                style={[styles.chip, item.unit === unit && styles.chipSelected]}>
                <Text style={[styles.chipText, item.unit === unit && styles.chipTextSelected]}>{unit}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.subtotal}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>{formatCOP(lineTotal(item))}</Text>
          </View>
        </Card>
      ))}
      <Button title="Agregar actividad" variant="outline" size="sm" onPress={() => setItems((prev) => [...prev, emptyItem()])} />

      <SectionTitle>Materiales</SectionTitle>
      <Text style={styles.help}>
        {allInclusive
          ? 'Todo incluido: tú suministras estos materiales. Indica un costo estimado para que Xpertos asigne su valor.'
          : 'Solo mano de obra: el cliente compra estos materiales antes del inicio.'}
      </Text>
      {materials.map((m, idx) => (
        <Card key={m.key} style={styles.card}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle}>Material {idx + 1}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eliminar material ${idx + 1}`}
              onPress={() => setMaterials((prev) => prev.filter((x) => x.key !== m.key))}
              hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
          <Input label="Nombre" value={m.name} onChangeText={(name) => updateMaterial(m.key, { name })} placeholder='Ej. Sifón PVC 1 1/2"' />
          <View style={styles.inline}>
            <Input
              label="Cantidad"
              value={m.quantity}
              onChangeText={(quantity) => updateMaterial(m.key, { quantity: quantity.replace(/[^0-9.,]/g, '') })}
              keyboardType="decimal-pad"
              containerStyle={styles.qty}
            />
            <View style={styles.price}>
              <Select
                label="Unidad"
                options={materialUnits.map((u) => ({ value: u, label: u }))}
                value={m.unit}
                onChange={(unit) => updateMaterial(m.key, { unit })}
              />
            </View>
          </View>
          <Input
            label={allInclusive ? 'Costo estimado (sugerido)' : 'Costo estimado (opcional)'}
            value={m.estimatedCost}
            onChangeText={(estimatedCost) => updateMaterial(m.key, { estimatedCost: estimatedCost.replace(/\D/g, '') })}
            keyboardType="number-pad"
            placeholder="0"
            hint={m.estimatedCost ? `${formatCOP(parseMoney(m.estimatedCost))} en total para este material` : 'Valor total estimado de este material.'}
          />
          <Input label="Notas" value={m.notes} onChangeText={(v) => updateMaterial(m.key, { notes: v })} placeholder="Marca, referencia, color…" />
        </Card>
      ))}
      <Button title="Agregar material" variant="outline" size="sm" onPress={() => setMaterials((prev) => [...prev, emptyMaterial()])} />

      <SectionTitle right={<Text style={styles.sectionTotal}>{loaded.photos.length}</Text>}>Fotos del antes</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.help}>Toma fotos del estado actual del lugar. Se necesita al menos una para enviar la cotización.</Text>
        <PhotoGrid photos={loaded.photos} onRemove={removePhoto} emptyText="Aún no has agregado fotos del antes." />
        <View style={styles.inline}>
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
      </Card>

      <SectionTitle>Notas</SectionTitle>
      <Card style={styles.card}>
        <Input value={notes} onChangeText={setNotes} multiline placeholder="Condiciones, supuestos, lo que no incluye la cotización…" />
      </Card>

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total mano de obra</Text>
          <Text style={styles.totalValue}>{formatCOP(laborTotal)}</Text>
        </View>
        {allInclusive ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelMuted}>Materiales (estimado, lo valida Xpertos)</Text>
            <Text style={styles.totalValueMuted}>{formatCOP(materialsEstimate)}</Text>
          </View>
        ) : null}
        <Text style={styles.totalHint}>Xpertos revisa los valores antes de enviarlos al cliente.</Text>
      </View>

      <Button title="Guardar borrador" variant="outline" onPress={saveDraft} loading={saving === 'draft'} disabled={saving !== null || uploading} />
      <Button title="Enviar cotización" onPress={submit} loading={saving === 'submit'} disabled={saving !== null || uploading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  serviceTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  returned: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius,
    padding: spacing.md,
  },
  returnedText: { flex: 1, gap: 2 },
  returnedTitle: { fontSize: 15, fontWeight: '800', color: colors.warning },
  returnedNotes: { fontSize: 14, color: colors.text, lineHeight: 20 },
  modes: { gap: spacing.sm },
  mode: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  modeSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft, borderWidth: 2 },
  modeText: { flex: 1, gap: 2 },
  modeLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  modeLabelSelected: { color: colors.primary },
  modeDescription: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  sectionTotal: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  inline: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  qty: { flexBasis: 100, flexGrow: 1 },
  price: { flexBasis: 150, flexGrow: 2 },
  flex: { flexGrow: 1, flexBasis: 140 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextSelected: { color: '#FFFFFF' },
  subtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  subtotalLabel: { fontSize: 14, color: colors.textMuted },
  subtotalValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  totals: { backgroundColor: colors.primarySoft, borderRadius: radius, padding: spacing.md, gap: spacing.xs },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
  totalLabelMuted: { flex: 1, fontSize: 14, color: colors.text },
  totalValueMuted: { fontSize: 15, fontWeight: '700', color: colors.text },
  totalHint: { fontSize: 12, color: colors.slate },
});
