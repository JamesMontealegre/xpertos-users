import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import { APP_VERSION } from '@/lib/version';

const CHECK_MS = 60_000;
const SAFE_CHECK_MS = 5_000;
/** Sin tocar la app durante este tiempo se considera que el usuario no está haciendo nada. */
const IDLE_MS = 15_000;

const RELOADED_KEY = 'xp-reloaded-for';

/**
 * Recarga una sola vez por versión: si después de recargar el navegador sigue con el código anterior
 * (p. ej. por una caché), no se entra en un ciclo de recargas; queda el botón "Actualizar ahora".
 */
function autoReload(version: string) {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === version) return;
    sessionStorage.setItem(RELOADED_KEY, version);
  } catch {
    // Sin sessionStorage (navegación privada estricta): se recarga igual.
  }
  window.location.reload();
}

/** true si hay algo escrito en un campo (se perdería al recargar). */
function hasDraft() {
  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([readonly]), textarea:not([readonly])'
  );
  return [...fields].some((f) => f.value.trim() !== '');
}

/**
 * Recarga automática en la web al publicar una versión nueva. Cada minuto (y al volver a la app)
 * consulta /version.json; si cambió, recarga en cuanto sea seguro para no perder lo que se esté
 * haciendo: al cambiar de pantalla, o cuando no hay nada escrito en los campos, no se está escribiendo
 * y la app lleva unos segundos sin tocarse. Mientras tanto muestra "Actualizar ahora".
 * En el celular nativo las actualizaciones irán por la tienda o por Expo Updates.
 */
export function UpdateWatcher() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const pendingPath = useRef<string | null>(null);
  const pendingVersion = useRef('');
  const lastInput = useRef(0);
  const enabled = Platform.OS === 'web' && APP_VERSION !== 'dev';

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (!stopped && version && version !== APP_VERSION && pendingPath.current === null) {
          pendingPath.current = window.location.pathname;
          pendingVersion.current = version;
          setPending(true);
        }
      } catch {
        // Sin conexión: se vuelve a intentar en la próxima revisión.
      }
    };

    const safeToReload = () => {
      if (pendingPath.current === null) return false;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return false;
      if (hasDraft()) return false;
      return document.visibilityState === 'hidden' || Date.now() - lastInput.current > IDLE_MS;
    };

    const markInput = () => {
      lastInput.current = Date.now();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };

    const first = setTimeout(check, 10_000);
    const interval = setInterval(check, CHECK_MS);
    const safe = setInterval(() => {
      if (safeToReload()) autoReload(pendingVersion.current);
    }, SAFE_CHECK_MS);
    window.addEventListener('keydown', markInput, { passive: true });
    window.addEventListener('pointerdown', markInput, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(interval);
      clearInterval(safe);
      window.removeEventListener('keydown', markInput);
      window.removeEventListener('pointerdown', markInput);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled]);

  // Al cambiar de pantalla con una versión nueva pendiente, se carga la app completa con el código nuevo.
  useEffect(() => {
    if (pending && pendingPath.current !== null && pathname !== pendingPath.current) autoReload(pendingVersion.current);
  }, [pathname, pending]);

  if (!pending) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.pill} accessibilityRole="alert">
        <Text style={styles.text}>Hay una versión nueva de Xpertos</Text>
        <Pressable accessibilityRole="button" onPress={() => window.location.reload()} style={styles.button}>
          <Text style={styles.buttonText}>Actualizar ahora</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 84, alignItems: 'center', zIndex: 90 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingLeft: spacing.md,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: { fontSize: 14, color: colors.text },
  button: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
