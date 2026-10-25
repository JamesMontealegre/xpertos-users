import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import { NEXT_NEW_SERVICE } from '@/lib/home';

const STEPS = [
  {
    title: 'Crea tu cuenta',
    body: 'Es gratis y toma un minuto. Con ella sigues tu servicio, tu cotización y tus pagos desde la app.',
  },
  {
    title: 'Cuéntanos qué necesitas',
    body: 'Describe el trabajo, agrega fotos y dinos cuándo puedes recibir al experto.',
  },
  {
    title: 'Recibe tu cotización',
    body: 'Un experto verificado la prepara y nosotros la revisamos antes de enviártela.',
  },
];

/** Entrada desde "Solicitar un servicio" de la landing: explica los pasos antes de pedir la cuenta. */
export default function RequestServiceWelcome() {
  return (
    <Screen>
      <View style={styles.wrapper}>
        <Brand />
        <Card style={styles.card}>
          <Text style={styles.title}>Pide tu servicio en 3 pasos</Text>
          {STEPS.map((step, i) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.number}>
                <Text style={styles.numberText}>{i + 1}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
          <Button
            title="Crear mi cuenta"
            onPress={() => router.push({ pathname: '/(auth)/register', params: { next: NEXT_NEW_SERVICE } })}
          />
          <Button
            title="Ya tengo cuenta, ingresar"
            variant="outline"
            onPress={() => router.push({ pathname: '/(auth)/login', params: { next: NEXT_NEW_SERVICE } })}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  number: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  stepBody: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
});
