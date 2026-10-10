import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PhotoGrid } from '@/components/service/photo-grid';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, InfoBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { capitalizeFirst, dateRangeISO, formatPlainDate, formatShortPlainDate, formatTime, isWeekendISO, todayCO } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useFeedback } from '@/providers/feedback';

export type WorkLog = Tables<'work_logs'> & { work_log_photos: Tables<'work_log_photos'>[] };

type Props = {
  service: Tables<'services'>;
  schedule: Tables<'service_schedule'> | null;
  logs: WorkLog[];
  holidays: string[];
  /** Experto con el servicio En ejecución: puede registrar jornadas. */
  editable: boolean;
};

function hoursLabel(log: WorkLog): string | null {
  if (log.check_in && log.check_out) return `${formatTime(log.check_in)} – ${formatTime(log.check_out)}`;
  if (log.check_in) return `Ingreso ${formatTime(log.check_in)}`;
  return null;
}

/** Registro de jornadas: calendario editable para el experto, lista de solo lectura para los demás. */
export function WorkLogsSection({ service, schedule, logs, holidays, editable }: Props) {
  const today = todayCO();
  const byDate = new Map(logs.map((l) => [l.work_date, l]));
  const daily = service.payout_frequency === 'daily';

  if (!editable) {
    const sorted = [...logs].sort((a, b) => b.work_date.localeCompare(a.work_date));
    return (
      <>
        <SectionTitle right={<Text style={styles.count}>{logs.length}</Text>}>Jornadas registradas</SectionTitle>
        <Card style={styles.card}>
          {sorted.length === 0 ? (
            <Text style={styles.muted}>Aún no hay jornadas registradas.</Text>
          ) : (
            sorted.map((log) => (
              <View key={log.id} style={styles.readRow}>
                <View style={styles.readHead}>
                  <Ionicons name="calendar-clear-outline" size={16} color={colors.primary} />
                  <Text style={styles.readDate}>{capitalizeFirst(formatPlainDate(log.work_date))}</Text>
                  {hoursLabel(log) ? <Text style={styles.readHours}>{hoursLabel(log)}</Text> : null}
                </View>
                {log.notes ? <Text style={styles.readNotes}>{log.notes}</Text> : null}
                <PhotoGrid photos={log.work_log_photos} size={84} />
              </View>
            ))
          )}
        </Card>
      </>
    );
  }

  const start = service.start_date ?? schedule?.start_date ?? today;
  const plannedEnd = schedule?.estimated_end_date ?? today;
  const end = plannedEnd > today ? plannedEnd : today;
  const days = dateRangeISO(start, end);
  const holidaySet = new Set(holidays);

  return (
    <>
      <SectionTitle right={<Text style={styles.count}>{logs.length}</Text>}>Registro de jornadas</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.help}>
          Toca un día para registrar la hora de ingreso, la hora de salida, notas y fotos del trabajo. El primer día y el día de
          cierre, con fotos, son obligatorios.
        </Text>
        {daily ? (
          <InfoBanner tone="warning" message="Tu pago es diario: todas las jornadas en días hábiles son obligatorias." />
        ) : null}
        <View style={styles.days}>
          {days.map((day) => {
            const log = byDate.get(day);
            const future = day > today;
            const isToday = day === today;
            const nonBusiness = isWeekendISO(day) || holidaySet.has(day);
            const required = day === start || (daily && !nonBusiness && !future);
            const photos = log?.work_log_photos.length ?? 0;
            const hours = log ? hoursLabel(log) : null;
            const complete = Boolean(log && photos > 0 && log.check_in && log.check_out);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`Jornada del ${formatPlainDate(day)}`}
                aria-disabled={future}
                disabled={future}
                onPress={() => router.push({ pathname: '/service/[id]/work/[date]', params: { id: service.id, date: day } })}
                style={({ pressed }) => [
                  styles.day,
                  isToday && styles.dayToday,
                  future && styles.dayFuture,
                  pressed && styles.pressed,
                ]}>
                <View
                  style={[
                    styles.dayIcon,
                    complete ? styles.iconDone : log ? styles.iconPartial : required && !future ? styles.iconMissing : null,
                  ]}>
                  <Ionicons
                    name={complete ? 'checkmark' : log ? 'time-outline' : future ? 'lock-closed-outline' : 'add'}
                    size={16}
                    color={complete ? '#FFFFFF' : log ? colors.primary : required && !future ? colors.danger : colors.textMuted}
                  />
                </View>
                <View style={styles.dayMain}>
                  <View style={styles.dayTitleRow}>
                    <Text style={[styles.dayTitle, future && styles.dayTitleFuture]}>{capitalizeFirst(formatShortPlainDate(day))}</Text>
                    {isToday ? <Tag label="Hoy" tone="primary" /> : null}
                    {required ? <Tag label={day === start ? 'Obligatorio · primer día' : 'Obligatorio'} tone="danger" /> : null}
                    {nonBusiness ? <Tag label="No hábil" tone="muted" /> : null}
                  </View>
                  <Text style={styles.dayMeta}>
                    {future
                      ? 'Disponible ese día'
                      : log
                        ? [hours ?? 'Sin horas', photos > 0 ? `${photos} ${photos === 1 ? 'foto' : 'fotos'}` : 'Sin fotos'].join(' · ')
                        : 'Sin registro'}
                  </Text>
                </View>
                {!future ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>
    </>
  );
}

function Tag({ label, tone }: { label: string; tone: 'primary' | 'danger' | 'muted' }) {
  const palette = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    muted: { bg: colors.slateSoft, fg: colors.slate },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: palette.bg }]}>
      <Text style={[styles.tagText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

/** Cierre del trabajo: muestra lo que falta (close_work_missing) o pide notas y cierra (close_work). */
export function CloseWorkSection({ service, onChanged }: { service: Tables<'services'>; onChanged: () => Promise<void> }) {
  const [checking, setChecking] = useState(false);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [notes, setNotes] = useState('');
  const [closing, setClosing] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const { confirm, toast } = useFeedback();

  const check = async () => {
    setError(null);
    setChecking(true);
    const { data, error: rpcError } = await supabase.rpc('close_work_missing', { p_service_id: service.id });
    setChecking(false);
    if (rpcError) return setError(rpcError.message);
    setMissing(data ?? []);
  };

  const close = async () => {
    setError(null);
    const ok = await confirm({
      title: 'Cerrar el trabajo',
      message: 'El servicio pasa a En observación y ya no podrás editar las jornadas. Xpertos verificará con el cliente que todo esté bien.',
      confirmLabel: 'Cerrar trabajo',
    });
    if (!ok) return;
    setClosing(true);
    const { error: rpcError } = await supabase.rpc('close_work', { p_service_id: service.id, p_notes: notes.trim() || undefined });
    setClosing(false);
    if (rpcError) return setError(`No se pudo cerrar el trabajo: ${rpcError.message}`);
    toast('Trabajo cerrado. Xpertos verificará con el cliente en máximo 1 día hábil.', 'success');
    setMissing(null);
    setNotes('');
    await onChanged();
  };

  return (
    <>
      <SectionTitle>Cerrar trabajo</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.help}>
          Cuando termines, cierra el trabajo: el servicio pasa a En observación y Xpertos verifica con el cliente en máximo 1 día
          hábil.
        </Text>
        <ErrorBanner seq={errorSeq} message={error} />
        {missing === null ? (
          <Button title="Cerrar trabajo" variant="secondary" onPress={check} loading={checking} />
        ) : missing.length > 0 ? (
          <>
            <View style={styles.missingBox}>
              <Text style={styles.missingTitle}>Para cerrar el trabajo falta:</Text>
              {missing.map((item) => (
                <View key={item} style={styles.missingRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.missingText}>{item}</Text>
                </View>
              ))}
            </View>
            <Button title="Volver a revisar" variant="outline" onPress={check} loading={checking} />
          </>
        ) : (
          <>
            <InfoBanner tone="success" message="Tienes todo lo necesario para cerrar el trabajo." />
            <Input
              label="Notas de cierre"
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Qué se hizo, recomendaciones de uso o garantía, pendientes acordados…"
            />
            <Button title="Confirmar cierre" variant="secondary" onPress={close} loading={closing} />
            <Button title="Cancelar" variant="ghost" onPress={() => setMissing(null)} />
          </>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  count: { color: colors.textMuted, fontWeight: '700' },
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  muted: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  days: { gap: spacing.xs },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  dayToday: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  dayFuture: { opacity: 0.55, backgroundColor: colors.background },
  pressed: { opacity: 0.8 },
  dayIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  iconPartial: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  iconMissing: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  dayMain: { flex: 1, gap: 2 },
  dayTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  dayTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  dayTitleFuture: { color: colors.textMuted },
  dayMeta: { fontSize: 13, color: colors.textMuted },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  tagText: { fontSize: 11, fontWeight: '700' },
  readRow: { gap: 6, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  readHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  readDate: { fontSize: 14, fontWeight: '700', color: colors.text },
  readHours: { fontSize: 13, color: colors.primary, fontWeight: '700', marginLeft: 'auto' },
  readNotes: { fontSize: 14, color: colors.text, lineHeight: 20 },
  missingBox: { backgroundColor: colors.dangerSoft, borderRadius: radius, padding: spacing.md, gap: spacing.xs },
  missingTitle: { fontSize: 14, fontWeight: '700', color: colors.danger },
  missingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  missingText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
});
