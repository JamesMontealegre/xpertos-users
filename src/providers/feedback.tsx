import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { colors, maxContentWidth, radius, spacing } from '@/constants/theme';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción que no se puede deshacer: el botón de confirmar va en rojo. */
  destructive?: boolean;
};

type FeedbackContextValue = {
  /** Aviso flotante arriba de la pantalla (se ve aunque se esté al final de un formulario). */
  toast: (message: string, tone?: ToastTone) => void;
  /** Diálogo de confirmación; resuelve true si el usuario confirma. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

const TOAST_MS = { success: 4000, info: 5000, error: 7000 } as const;

const TONE = {
  success: { icon: 'checkmark-circle', color: colors.success, bg: colors.successSoft },
  error: { icon: 'alert-circle', color: colors.danger, bg: colors.dangerSoft },
  info: { icon: 'information-circle', color: colors.info, bg: colors.infoSoft },
} as const;

/**
 * Avisos y confirmaciones de la app: avisos flotantes (éxito, error, información) y un diálogo de
 * confirmación propio, iguales en web y en el celular.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      seq.current += 1;
      const id = seq.current;
      setToasts((list) => [...list.filter((t) => t.message !== message).slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), TOAST_MS[tone]);
    },
    [dismiss]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false);
    setDialog(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {toasts.length > 0 ? (
        <View pointerEvents="box-none" style={[styles.toasts, { top: insets.top + spacing.sm }]}>
          {toasts.map((t) => {
            const tone = TONE[t.tone];
            return (
              <View
                key={t.id}
                style={[styles.toast, { borderColor: tone.color }]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite">
                <View style={[styles.toastIcon, { backgroundColor: tone.bg }]}>
                  <Ionicons name={tone.icon} size={20} color={tone.color} />
                </View>
                <Text style={styles.toastText}>{t.message}</Text>
                <Pressable onPress={() => dismiss(t.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar aviso">
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={() => close(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} accessibilityLabel="Cerrar" />
          {dialog ? (
            <View style={styles.dialog} accessibilityRole="alert">
              <Text style={styles.dialogTitle}>{dialog.title}</Text>
              {dialog.message ? <Text style={styles.dialogMessage}>{dialog.message}</Text> : null}
              <View style={styles.dialogActions}>
                <Pressable onPress={() => close(false)} style={[styles.button, styles.buttonGhost]} accessibilityRole="button">
                  <Text style={styles.buttonGhostText}>{dialog.cancelLabel ?? 'Volver'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => close(true)}
                  style={[styles.button, { backgroundColor: dialog.destructive ? colors.danger : colors.primary }]}
                  accessibilityRole="button">
                  <Text style={styles.buttonText}>{dialog.confirmLabel ?? 'Confirmar'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback debe usarse dentro de FeedbackProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toasts: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center', gap: spacing.sm, zIndex: 200 },
  toast: {
    width: '100%',
    maxWidth: maxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    backgroundColor: colors.surface,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  toastText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius + 4,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  dialogMessage: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  button: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius },
  buttonGhost: { backgroundColor: colors.background },
  buttonGhostText: { fontSize: 15, fontWeight: '700', color: colors.text },
  buttonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
