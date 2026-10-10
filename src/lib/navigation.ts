import { router, type Href } from 'expo-router';

/**
 * Volver a una pantalla conocida. Si hay historial se regresa (conserva el scroll de la pantalla
 * anterior); si no lo hay —enlace abierto directo, recarga o recarga automática por versión nueva—,
 * `router.back()` no haría nada, así que se navega a `fallback`.
 */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
