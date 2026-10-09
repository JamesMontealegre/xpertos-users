/**
 * Máscaras de escritura: mientras el usuario escribe, el texto toma el formato que espera la base
 * (fecha AAAA-MM-DD y hora HH:mm de 24 horas) sin que tenga que poner guiones ni dos puntos.
 */

/** "20261201" → "2026-12-01". Un mes que empieza por 2–9 se completa con 0 ("20263" → "2026-03"), igual el día por 4–9. */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '');
  let year = digits.slice(0, 4);
  let rest = digits.slice(4);
  if (year.length < 4) return year;

  let month = '';
  if (rest.length > 0) {
    month = Number(rest[0]) > 1 ? `0${rest[0]}` : rest.slice(0, 2);
    rest = rest.slice(Number(rest[0]) > 1 ? 1 : 2);
  }
  let day = '';
  if (month.length === 2 && rest.length > 0) {
    day = Number(rest[0]) > 3 ? `0${rest[0]}` : rest.slice(0, 2);
  }
  year = year.slice(0, 4);
  return [year, month, day].filter(Boolean).join('-');
}

/**
 * "0830" → "08:30", "8" → "08", "8:3" → "08:3". Una hora que empieza por 3–9 se completa con 0; si se
 * escriben los dos puntos, lo de antes son las horas.
 */
export function maskTime(text: string): string {
  const clean = text.replace(/[^\d:]/g, '');
  const colon = clean.indexOf(':');
  let hours: string;
  let minutes: string;
  if (colon >= 0) {
    hours = clean.slice(0, colon).replace(/\D/g, '').slice(-2);
    minutes = clean.slice(colon + 1).replace(/\D/g, '').slice(0, 2);
    if (hours.length === 1) hours = `0${hours}`;
    return hours ? `${hours}:${minutes}` : '';
  }
  const digits = clean.slice(0, 4);
  if (digits.length === 0) return '';
  if (Number(digits[0]) > 2) {
    hours = `0${digits[0]}`;
    minutes = digits.slice(1, 3);
  } else {
    hours = digits.slice(0, 2);
    minutes = digits.slice(2, 4);
  }
  return minutes ? `${hours}:${minutes}` : hours;
}

/** Al salir del campo: "8" → "08:00", "08" → "08:00", "08:3" → "08:30". */
export function completeTime(text: string): string {
  const masked = maskTime(text);
  if (!masked) return '';
  const [h, m = ''] = masked.split(':');
  const hours = h.padStart(2, '0');
  const minutes = m.length === 0 ? '00' : m.padEnd(2, '0');
  return `${hours}:${minutes}`;
}
