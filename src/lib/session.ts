import type { Session } from '@supabase/supabase-js';

/** La cuenta entró con una clave temporal (creada al postularse desde la landing) y debe cambiarla. */
export function mustChangePassword(session: Session | null): boolean {
  return session?.user.user_metadata?.must_change_password === true;
}
