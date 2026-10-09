/** Validaciones de formularios (registro y cambio de contraseña). Devuelven el mensaje de error o null. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Letras (con tildes y ñ), espacios, apóstrofo, punto y guion.
const NAME_PART = /^[\p{L}][\p{L}'.-]*$/u;

export const PASSWORD_MIN_LENGTH = 8;

export function fullNameError(value: string): string | null {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Escribe tu nombre completo.';
  if (!parts.every((p) => NAME_PART.test(p))) return 'El nombre solo puede tener letras.';
  if (parts.length < 2 || parts.some((p) => p.length < 2)) return 'Escribe tu nombre y tu apellido.';
  return null;
}

export function emailError(value: string): string | null {
  const email = value.trim();
  if (!email) return 'Escribe tu correo electrónico.';
  if (!EMAIL.test(email)) return 'El correo no es válido. Ejemplo: nombre@correo.com';
  return null;
}

/**
 * Teléfono colombiano de 10 dígitos: celular (empieza por 3) o fijo (empieza por 60). Acepta el
 * indicativo +57 y espacios o guiones, que se quitan al guardar.
 */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits;
}

export function phoneError(value: string): string | null {
  if (!value.trim()) return 'Escribe tu número de celular.';
  const phone = normalizePhone(value);
  if (phone.length !== 10) return 'El número debe tener 10 dígitos. Ejemplo: 300 123 4567';
  if (!/^(3|60)/.test(phone)) return 'Escribe un celular (empieza por 3) o un fijo (empieza por 60).';
  return null;
}

export function cityError(value: string): string | null {
  const city = value.trim();
  if (!city) return 'Escribe tu ciudad.';
  if (city.length < 3 || !/^[\p{L}][\p{L}\s.'-]*$/u.test(city)) return 'Escribe una ciudad válida.';
  return null;
}

export function passwordError(value: string): string | null {
  if (!value) return 'Escribe una contraseña.';
  if (value.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) return 'La contraseña debe tener letras y números.';
  return null;
}

export function confirmPasswordError(password: string, confirm: string): string | null {
  if (!confirm) return 'Confirma tu contraseña.';
  if (password !== confirm) return 'Las contraseñas no coinciden.';
  return null;
}
