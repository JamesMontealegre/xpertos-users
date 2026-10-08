const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function formatCOP(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return copFormatter.format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Fecha en formato YYYY-MM-DD (sin zona horaria) → "mié, 14 oct 2026". */
export function formatPlainDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** "08:00:00" → "08:00". */
export function formatTime(value: string): string {
  return value.slice(0, 5);
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Hoy en Colombia en formato YYYY-MM-DD (coincide con today_co() de la base). */
export function todayCO(): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** Hora actual en Colombia en formato HH:MM. */
export function nowTimeCO(): string {
  return new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/** Suma días calendario a una fecha YYYY-MM-DD. */
export function addDaysISO(value: string, days: number): string {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Fechas YYYY-MM-DD de `from` a `to`, ambas incluidas (vacío si to < from). */
export function dateRangeISO(from: string, to: string): string[] {
  const out: string[] = [];
  for (let day = from; day <= to && out.length < 400; day = addDaysISO(day, 1)) out.push(day);
  return out;
}

/** true si la fecha YYYY-MM-DD cae sábado o domingo. */
export function isWeekendISO(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

/** "2026-10-08" → "jue, 8 oct". */
export function formatShortPlainDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Cantidad escrita por el usuario ("2,5", "3.75") → número; NaN si no es válida. */
export function parseQuantity(value: string): number {
  const clean = value.trim().replace(/\s/g, '');
  if (!clean) return NaN;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

/** Valor en pesos escrito por el usuario ("120.000", "$ 85000") → entero; NaN si está vacío. */
export function parseMoney(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : NaN;
}

/** Número para mostrar en un campo editable (2.5 → "2,5"). */
export function quantityToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace('.', ',');
}

/** Primera letra en mayúscula ("jue, 8 oct" → "Jue, 8 oct"). */
export function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
