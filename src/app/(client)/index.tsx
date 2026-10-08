import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { ServiceCard, type ServiceListItem } from '@/components/service-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner, Loading, Screen } from '@/components/ui/screen';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

export default function MyServicesScreen() {
  const { session } = useAuth();
  const [services, setServices] = useState<ServiceListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error: queryError } = await supabase
      .from('services')
      .select('*, service_categories(name)')
      .eq('client_id', session.user.id)
      .order('created_at', { ascending: false });
    if (queryError) {
      setError(`No pudimos cargar tus servicios: ${queryError.message}`);
    } else {
      setError(null);
      setServices(data);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen
      brand
      title="Mis servicios"
      subtitle="Sigue el estado de tus solicitudes"
      refreshing={refreshing}
      onRefresh={refresh}
      withTabs>
      <ErrorBanner message={error} />
      {services === null && !error ? (
        <Loading />
      ) : services && services.length === 0 ? (
        <EmptyState
          icon="home-outline"
          title="Aún no tienes servicios"
          description="Cuéntanos qué necesitas y un experto verificado se encargará."
          actionLabel="Solicitar un servicio"
          onAction={() => router.push('/(client)/new')}
        />
      ) : (
        services?.map((service) => <ServiceCard key={service.id} service={service} />)
      )}
    </Screen>
  );
}
