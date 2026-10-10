import type { Tables } from '@/lib/database.types';

/**
 * Valores que ve el cliente. La tarifa de servicio de Xpertos no se muestra aparte: va incluida en cada
 * valor (mano de obra y materiales), de modo que la suma da exactamente el total de cada opción.
 */
export function withClientFee(value: number, feePct: number): number {
  return Math.round(value * (1 + feePct / 100));
}

type Quote = Tables<'service_quotes'>;
type Material = Tables<'quote_materials'>;

/** Mano de obra y materiales (con la tarifa incluida) de la cotización presentada. */
export function presentedValues(quote: Quote, materials: Material[], feePct: number) {
  const labor = quote.total_labor_only != null ? Number(quote.total_labor_only) : withClientFee(Number(quote.approved_labor_total ?? quote.labor_total), feePct);
  const materialsTotal = quote.total_all_inclusive != null ? Number(quote.total_all_inclusive) - labor : null;
  const lines = new Map(
    materials.map((m) => [
      m.id,
      {
        unitPrice: m.unit_price != null ? withClientFee(Number(m.unit_price), feePct) : null,
        lineTotal: m.line_total != null ? withClientFee(Number(m.line_total), feePct) : null,
      },
    ])
  );
  return { labor, materialsTotal, lines };
}

/** Lo mismo para la opción ya elegida (el total es lo que paga). */
export function chosenValues(quote: Quote, materials: Material[], feePct: number) {
  const total = Number(quote.total ?? 0);
  const allInclusive = quote.pricing_mode === 'all_inclusive';
  const labor = allInclusive ? withClientFee(Number(quote.approved_labor_total ?? quote.labor_total), feePct) : total;
  const materialsTotal = allInclusive ? total - labor : null;
  const lines = new Map(
    materials.map((m) => [
      m.id,
      {
        unitPrice: allInclusive && m.unit_price != null ? withClientFee(Number(m.unit_price), feePct) : null,
        lineTotal: allInclusive && m.line_total != null ? withClientFee(Number(m.line_total), feePct) : null,
      },
    ])
  );
  return { labor, materialsTotal, total, lines };
}
