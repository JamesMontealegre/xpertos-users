import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type Identity = { document_type: string; document_number: string };

/**
 * Documento de identidad del usuario, para firmar contratos y actas. `undefined` mientras carga (o si no hace
 * falta: `enabled` en falso), `null` si aún no lo registró.
 */
export function useMyIdentity(userId: string, enabled: boolean) {
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined);
  const fetchIdentity = useCallback(
    () => supabase.from('profile_identity').select('document_type, document_number').eq('user_id', userId).maybeSingle(),
    [userId]
  );

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchIdentity().then(({ data }) => {
      if (active) setIdentity(data ?? null);
    });
    return () => {
      active = false;
    };
  }, [enabled, fetchIdentity]);

  const reload = async () => setIdentity((await fetchIdentity()).data ?? null);
  return { identity, reload };
}

/** Guarda el documento (y regenera el contrato pendiente con él). Devuelve un mensaje de error o null. */
export async function saveMyIdentity(documentType: string, documentNumber: string): Promise<string | null> {
  const { error } = await supabase.rpc('set_my_identity', { p_document_type: documentType, p_document_number: documentNumber });
  return error ? error.message : null;
}
