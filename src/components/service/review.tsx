import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { SectionBody, SectionTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBanner, useErrorState } from '@/components/ui/screen';
import { StarRating } from '@/components/ui/star-rating';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useFeedback } from '@/providers/feedback';

type Props = {
  service: Tables<'services'>;
  reviews: Tables<'service_reviews'>[];
  userId: string;
  counterpartName: string;
  onChanged: () => Promise<void>;
  /** Dentro de una sección plegable: sin título ni tarjeta propia. */
  embedded?: boolean;
};

export function ReviewSection({ service, reviews, userId, counterpartName, onChanged, embedded }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError, errorSeq] = useErrorState();
  const { confirm, toast } = useFeedback();

  const mine = reviews.find((r) => r.author_id === userId);
  const received = reviews.find((r) => r.target_id === userId);
  const targetId = userId === service.client_id ? service.expert_id : service.client_id;

  const submit = async () => {
    setError(null);
    if (!targetId) return setError('No hay contraparte a quien calificar.');
    if (rating < 1) return setError('Selecciona de 1 a 5 estrellas.');
    const ok = await confirm({
      title: 'Enviar calificación',
      message: `Calificarás a ${counterpartName} con ${rating} ${rating === 1 ? 'estrella' : 'estrellas'}. Después de enviarla no podrás cambiarla.`,
      confirmLabel: 'Enviar calificación',
    });
    if (!ok) return;
    setSaving(true);
    const { error: insertError } = await supabase.from('service_reviews').insert({
      service_id: service.id,
      author_id: userId,
      target_id: targetId,
      rating,
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (insertError) return setError(`No se pudo guardar la calificación: ${insertError.message}`);
    toast('¡Gracias! Tu calificación quedó registrada.', 'success');
    await onChanged();
  };

  return (
    <>
      {embedded ? null : <SectionTitle>Calificación</SectionTitle>}
      <SectionBody plain={embedded} style={styles.card}>
        <ErrorBanner seq={errorSeq} message={error} />
        {mine ? (
          <>
            <Text style={styles.label}>Tu calificación para {counterpartName}</Text>
            <StarRating value={mine.rating} size={24} />
            {mine.comment ? <Text style={styles.comment}>“{mine.comment}”</Text> : null}
            <Text style={styles.date}>{formatDateTime(mine.created_at)}</Text>
          </>
        ) : (
          <>
            <Text style={styles.label}>¿Cómo te fue con {counterpartName}?</Text>
            <StarRating value={rating} onChange={setRating} size={32} />
            <Input value={comment} onChangeText={setComment} multiline placeholder="Cuéntanos tu experiencia (opcional)" />
            <Button title="Enviar calificación" onPress={submit} loading={saving} />
          </>
        )}
        {received ? (
          <>
            <Text style={[styles.label, styles.receivedLabel]}>Calificación que recibiste</Text>
            <StarRating value={received.rating} size={20} />
            {received.comment ? <Text style={styles.comment}>“{received.comment}”</Text> : null}
          </>
        ) : null}
      </SectionBody>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  receivedLabel: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  comment: { fontSize: 14, color: colors.text, fontStyle: 'italic', lineHeight: 20 },
  date: { fontSize: 12, color: colors.textMuted },
});
