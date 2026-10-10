import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { ClientServiceView } from '@/components/service/client-view';
import { ExpertServiceView } from '@/components/service/expert-view';
import { BackFallback } from '@/components/back-fallback';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner, Loading, Screen, useErrorState } from '@/components/ui/screen';
import type { Tables } from '@/lib/database.types';
import { homeFor } from '@/lib/home';
import { WORK_STATUSES, type ServiceDetail } from '@/lib/service-detail';
import { supabase } from '@/lib/supabase';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { useAuth } from '@/providers/auth';
import { useFeedback } from '@/providers/feedback';

/** Detalle de un servicio: carga los datos y muestra la vista del cliente o la del experto. */
export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { confirm } = useFeedback();
  const { session, profile, isApplicant } = useAuth();
  // Sin sesión (p. ej. se cerró en otra pestaña) lleva al ingreso en vez de quedarse cargando.
  const guard = useRoleGuard(['client', 'expert', 'admin']);
  const [detail, setDetail] = useState<ServiceDetail | null>(null);
  const [error, setError, errorSeq] = useErrorState();
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!session || !id) return;
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*, service_categories(name)')
      .eq('id', id)
      .maybeSingle();
    if (serviceError) {
      setError(`No pudimos cargar el servicio: ${serviceError.message}`);
      return;
    }
    if (!service) {
      setNotFound(true);
      return;
    }
    const isClient = service.client_id === session.user.id;
    const counterpartId = isClient ? service.expert_id : service.client_id;
    const hasWork = WORK_STATUSES.includes(service.status);
    const [photos, stages, payments, contract, reviews, events, counterpart, quote, schedule, accounts, logs] = await Promise.all([
      supabase.from('service_photos').select('*').eq('service_id', id).order('created_at'),
      supabase.from('service_stages').select('*').eq('service_id', id).order('position'),
      supabase.from('payments').select('*').eq('service_id', id).order('created_at', { ascending: false }),
      supabase.from('contracts').select('*').eq('service_id', id).maybeSingle(),
      supabase.from('service_reviews').select('*').eq('service_id', id),
      supabase.from('service_events').select('*').eq('service_id', id).order('created_at'),
      counterpartId ? supabase.from('profiles').select('*').eq('id', counterpartId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('service_quotes').select('*, quote_items(*), quote_materials(*)').eq('service_id', id).maybeSingle(),
      supabase.from('service_schedule').select('*').eq('service_id', id).maybeSingle(),
      isClient
        ? supabase.from('payment_accounts').select('*').eq('active', true).order('sort_order')
        : Promise.resolve({ data: [] as Tables<'payment_accounts'>[] }),
      hasWork
        ? supabase.from('work_logs').select('*, work_log_photos(*)').eq('service_id', id).order('work_date')
        : Promise.resolve({ data: [] as ServiceDetail['logs'] }),
    ]);
    const [signatures, holidays] = await Promise.all([
      contract.data
        ? supabase.from('contract_signatures').select('*').eq('contract_id', contract.data.id)
        : Promise.resolve({ data: [] as Tables<'contract_signatures'>[] }),
      service.status === 'in_progress' && service.start_date
        ? supabase.from('holidays').select('day').gte('day', service.start_date)
        : Promise.resolve({ data: [] as { day: string }[] }),
    ]);

    const { quote_items: items, quote_materials: materials, ...quoteRow } = quote.data ?? { quote_items: [], quote_materials: [] };
    setError(null);
    setDetail({
      service,
      photos: photos.data ?? [],
      stages: stages.data ?? [],
      payments: payments.data ?? [],
      contract: contract.data ?? null,
      signatures: signatures.data ?? [],
      reviews: reviews.data ?? [],
      events: events.data ?? [],
      counterpart: counterpart.data ?? null,
      quote: quote.data ? (quoteRow as Tables<'service_quotes'>) : null,
      items: [...items].sort((a, b) => a.position - b.position),
      materials: [...materials].sort((a, b) => a.position - b.position),
      schedule: schedule.data ?? null,
      accounts: accounts.data ?? [],
      logs: logs.data ?? [],
      holidays: (holidays.data ?? []).map((h) => h.day),
    });
  }, [session, id, setError]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setError('No pudimos cargar la información. Revisa tu conexión e intenta de nuevo.'));
    }, [load, setError])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const cancelRequest = async () => {
    if (!detail) return;
    setUpdating(true);
    setError(null);
    const { error: updateError } = await supabase.from('services').update({ status: 'cancelled' }).eq('id', detail.service.id);
    setUpdating(false);
    if (updateError) {
      setError(`No se pudo cancelar la solicitud: ${updateError.message}`);
      return;
    }
    await load();
  };

  const confirmCancel = async () => {
    const ok = await confirm({
      title: 'Cancelar solicitud',
      message: '¿Seguro que quieres cancelar esta solicitud? No podrás reactivarla.',
      confirmLabel: 'Cancelar solicitud',
      destructive: true,
    });
    if (ok) cancelRequest();
  };

  if (guard) return guard;
  if (notFound) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Servicio no encontrado" description="Puede que no tengas acceso o que haya sido eliminado." />
      </Screen>
    );
  }
  if (!detail || !session || !profile) {
    return (
      <Screen>
        <ErrorBanner seq={errorSeq} message={error} />
        {error ? <Button title="Reintentar" variant="outline" onPress={() => void load()} /> : <Loading />}
      </Screen>
    );
  }

  const { service } = detail;
  const userId = session.user.id;
  const isClient = service.client_id === userId;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: service.title }} />
      {profile ? <BackFallback href={homeFor(profile, isApplicant)} label="Ir al inicio" /> : null}
      <ErrorBanner seq={errorSeq} message={error} />

      {isClient ? (
        <ClientServiceView detail={detail} userId={userId} onChanged={load} onCancelRequest={confirmCancel} cancelling={updating} />
      ) : (
        <ExpertServiceView detail={detail} userId={userId} onChanged={load} />
      )}
    </Screen>
  );
}
