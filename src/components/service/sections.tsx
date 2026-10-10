import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { KeyValue } from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import { useScreenScroll } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type SectionSpec = { title: string; subtitle?: string | null; icon: IconName; right?: ReactNode; body: ReactNode };

/**
 * Estado de las secciones plegables del detalle de un servicio: todas cerradas al inicio. `reveal` abre una
 * sección y lleva la pantalla hasta ella (para los botones de "Qué sigue").
 */
export function useSections<K extends string>() {
  const { scrollToY } = useScreenScroll();
  const [open, setOpen] = useState<Partial<Record<K, boolean>>>({});
  const positions = useRef<Partial<Record<K, number>>>({});

  const toggle = (key: K) => setOpen((current) => ({ ...current, [key]: !current[key] }));
  const reveal = (key: K) => {
    setOpen((current) => ({ ...current, [key]: true }));
    // Después de abrirla: antes el contenido aún no tiene la altura para llegar hasta la sección.
    setTimeout(() => {
      const y = positions.current[key];
      if (y != null) scrollToY(y);
    }, 120);
  };
  const track = (key: K, y: number) => {
    positions.current[key] = y;
  };
  return { open, toggle, reveal, track };
}

/** Las secciones plegables en el orden dado. */
export function SectionList<K extends string>({
  order,
  sections,
  state,
}: {
  order: K[];
  sections: Record<K, SectionSpec>;
  state: ReturnType<typeof useSections<K>>;
}) {
  return (
    <>
      {order.map((key) => {
        const section = sections[key];
        return (
          <Collapsible
            key={key}
            title={section.title}
            subtitle={section.subtitle}
            icon={section.icon}
            right={section.right}
            open={Boolean(state.open[key])}
            onToggle={() => state.toggle(key)}
            onLayout={(e) => state.track(key, e.nativeEvent.layout.y)}>
            {section.body}
          </Collapsible>
        );
      })}
    </>
  );
}

export function NextSteps({ title = 'Qué sigue', footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <View style={styles.next}>
      <Text style={styles.nextTitle}>{title}</Text>
      {children}
      {footer ? <Text style={styles.nextFooter}>{footer}</Text> : null}
    </View>
  );
}

const STEP_ICON: Record<'todo' | 'waiting' | 'alert' | 'done', { name: IconName; color: string }> = {
  todo: { name: 'ellipse-outline', color: colors.primary },
  waiting: { name: 'hourglass-outline', color: colors.info },
  alert: { name: 'alert-circle', color: colors.danger },
  done: { name: 'checkmark-circle', color: colors.success },
};

export type StepState = keyof typeof STEP_ICON;

export function Step({
  state,
  title,
  detail,
  action,
}: {
  state: StepState;
  title: string;
  detail: string;
  action?: { label: string; onPress: () => void } | null;
}) {
  const icon = STEP_ICON[state];
  return (
    <View style={styles.step}>
      <Ionicons name={icon.name} size={22} color={icon.color} />
      <View style={styles.stepText}>
        <Text style={[styles.stepTitle, state === 'done' && styles.stepDone]}>{title}</Text>
        <Text style={styles.stepDetail}>{detail}</Text>
        {action ? (
          <View style={styles.stepAction}>
            <Button title={action.label} size="sm" variant="secondary" onPress={action.onPress} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Datos clave del resumen en dos columnas; los vacíos no se muestran y la dirección va a lo ancho. */
export function Facts({ facts, address }: { facts: [string, string | null | undefined][]; address?: string | null }) {
  return (
    <View style={styles.facts}>
      {facts
        .filter((fact): fact is [string, string] => Boolean(fact[1]))
        .map(([label, value]) => (
          <View key={label} style={styles.fact}>
            <KeyValue label={label} value={value} />
          </View>
        ))}
      {address !== undefined ? (
        <View style={styles.factWide}>
          <KeyValue label="Dirección" value={address} />
        </View>
      ) : null}
    </View>
  );
}

export function daysLabel(n: number | null | undefined): string | null {
  return n == null ? null : `${n} ${n === 1 ? 'día hábil' : 'días hábiles'}`;
}

const styles = StyleSheet.create({
  next: { backgroundColor: colors.primarySoft, borderRadius: radius, padding: spacing.md, gap: spacing.md },
  nextTitle: { fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  nextFooter: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  stepDone: { color: colors.textMuted },
  stepDetail: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  stepAction: { alignSelf: 'flex-start', marginTop: spacing.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, columnGap: spacing.md },
  fact: { flexGrow: 1, flexBasis: '45%', minWidth: 140 },
  factWide: { flexBasis: '100%' },
});
