import { Select } from '@/components/ui/select';

const toMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** "14:30" → "2:30 p. m.". */
export function timeLabel(value: string): string {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

type Props = {
  label?: string;
  placeholder?: string;
  /** Hora elegida HH:mm ('' si no hay). */
  value: string;
  onChange: (value: string) => void;
  /** Solo ofrece horas posteriores a esta (p. ej. la hora de inicio). */
  after?: string;
  /** Solo ofrece horas anteriores a esta. */
  before?: string;
  /** Primera y última hora de la lista (HH:mm) y salto en minutos. */
  from?: string;
  to?: string;
  step?: number;
};

/** Hora elegida de una lista (cada `step` minutos) en lugar de escribirla con formato. */
export function TimeSelect({
  label,
  placeholder = 'Elige la hora',
  value,
  onChange,
  after,
  before,
  from = '06:00',
  to = '21:00',
  step = 30,
}: Props) {
  const times: string[] = [];
  for (let t = toMinutes(from); t <= toMinutes(to); t += step) times.push(toTime(t));
  // Una hora guardada antes o puesta con "Ahora" que no cae en la lista también se muestra.
  if (value && !times.includes(value)) times.push(value);
  const options = times
    .filter((t) => (!after || t > after) && (!before || t < before))
    .sort()
    .map((t) => ({ value: t, label: timeLabel(t) }));

  return <Select label={label} placeholder={placeholder} options={options} value={value || null} onChange={onChange} />;
}
