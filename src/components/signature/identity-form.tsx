import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner, useErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/constants/theme';

const TYPES = [
  { value: 'CC', label: 'Cédula' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PPT', label: 'PPT' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'NIT', label: 'NIT' },
] as const;

type Props = {
  /** Guarda el documento; devuelve un mensaje de error o nada si quedó guardado. */
  onSubmit: (documentType: string, documentNumber: string) => Promise<string | null | void>;
};

/** Documento de identidad del cliente, que va en el contrato. Se pide una vez, antes de su primera firma. */
export function IdentityForm({ onSubmit }: Props) {
  const [type, setType] = useState<string>('CC');
  const [number, setNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const clean = number.replace(/[\s.]/g, '');

  const save = async () => {
    setError(null);
    if (!/^[A-Za-z0-9-]{4,20}$/.test(clean)) return setError('Revisa el número de documento.');
    setSaving(true);
    try {
      const message = await onSubmit(type, clean.toUpperCase());
      if (message) setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Tu documento de identidad</Text>
      <Text style={styles.help}>Va en el contrato junto a tu nombre. Lo pedimos una sola vez y solo lo ven tú y Xpertos.</Text>
      <ErrorBanner seq={errorSeq} message={error} />
      <View style={styles.types} accessibilityRole="radiogroup">
        {TYPES.map((t) => (
          <Pressable
            key={t.value}
            accessibilityRole="radio"
            aria-checked={type === t.value}
            onPress={() => setType(t.value)}
            style={[styles.type, type === t.value && styles.typeSelected]}>
            <Text style={[styles.typeText, type === t.value && styles.typeTextSelected]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <Input
        label="Número"
        value={number}
        onChangeText={setNumber}
        keyboardType={type === 'CC' || type === 'NIT' ? 'number-pad' : 'default'}
        autoCapitalize="characters"
        placeholder={type === 'CC' ? 'Ej.: 1020304050' : undefined}
        onSubmitEditing={save}
      />
      <Button title="Guardar y continuar" onPress={save} loading={saving} disabled={clean.length < 4} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius, padding: spacing.md },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  help: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  type: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  typeSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeText: { fontSize: 13, color: colors.text },
  typeTextSelected: { color: colors.primary, fontWeight: '700' },
});
