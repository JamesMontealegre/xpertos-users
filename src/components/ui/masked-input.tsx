import { Input } from '@/components/ui/input';
import { completeTime, maskDate, maskTime } from '@/lib/masks';

type InputProps = React.ComponentProps<typeof Input>;
type Props = Omit<InputProps, 'value' | 'onChangeText' | 'keyboardType' | 'maxLength'> & {
  value: string;
  onChangeText: (value: string) => void;
};

/**
 * Campo con máscara: al escribir se aplica el formato. Si se borra o reemplaza en medio del texto se deja
 * como está (para no reacomodar los números mientras se corrige) y se vuelve a formatear al salir.
 */
function MaskedInput({
  value,
  onChangeText,
  onBlur,
  mask,
  complete = mask,
  ...rest
}: Props & { mask: (text: string) => string; complete?: (text: string) => string; maxLength: number }) {
  return (
    <Input
      {...rest}
      value={value}
      onChangeText={(text) => {
        // Borrar al final se sigue formateando; borrar o reemplazar en medio se formatea al salir.
        const editingInside = text.length < value.length && !value.startsWith(text);
        onChangeText(editingInside ? text.replace(/[^\d:-]/g, '') : mask(text));
      }}
      onBlur={(e) => {
        if (value) onChangeText(complete(value));
        onBlur?.(e);
      }}
      keyboardType="number-pad"
      inputMode="numeric"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

/** Fecha AAAA-MM-DD: los guiones se ponen solos ("20261201" → "2026-12-01"). */
export function DateInput({ placeholder = 'AAAA-MM-DD', ...props }: Props) {
  return <MaskedInput {...props} placeholder={placeholder} mask={maskDate} maxLength={10} />;
}

/** Hora HH:mm de 24 horas: los dos puntos se ponen solos y al salir se completa ("8" → "08:00"). */
export function TimeInput({ placeholder = '08:00', ...props }: Props) {
  return <MaskedInput {...props} placeholder={placeholder} mask={maskTime} complete={completeTime} maxLength={5} />;
}
