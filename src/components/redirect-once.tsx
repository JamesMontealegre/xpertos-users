import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { Loading } from '@/components/ui/screen';

/**
 * Redirección de una sola vez. El <Redirect> de expo-router usa useFocusEffect sin memoizar y,
 * cuando se renderiza desde un layout que se re-renderiza durante la navegación, puede disparar
 * `replace` en bucle ("Maximum update depth exceeded"). Aquí solo se ejecuta cuando cambia el href.
 */
export function RedirectOnce({ href }: { href: Href }) {
  useEffect(() => {
    const id = setTimeout(() => router.replace(href), 0);
    return () => clearTimeout(id);
  }, [href]);
  return <Loading />;
}
