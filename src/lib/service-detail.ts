import type { WorkLog } from '@/components/service/work-logs';
import type { Enums, Tables } from '@/lib/database.types';

export type Slot = { date: string; from: string; to: string };

/** Acta de inicio con sus firmas (la ven el cliente, el experto asignado y el admin). */
export type StartActDetail = Tables<'start_acts'> & { start_act_signatures: Tables<'start_act_signatures'>[] };

/** Todo lo que carga la pantalla de detalle de un servicio. */
export type ServiceDetail = {
  service: Tables<'services'> & { service_categories: { name: string } | null };
  photos: Tables<'service_photos'>[];
  stages: Tables<'service_stages'>[];
  payments: Tables<'payments'>[];
  contract: Tables<'contracts'> | null;
  /** Orden de servicio del experto (solo la ven el experto asignado y el admin). */
  order: Tables<'service_orders'> | null;
  signatures: Tables<'contract_signatures'>[];
  startAct: StartActDetail | null;
  reviews: Tables<'service_reviews'>[];
  events: Tables<'service_events'>[];
  counterpart: Tables<'profiles'> | null;
  quote: Tables<'service_quotes'> | null;
  items: Tables<'quote_items'>[];
  materials: Tables<'quote_materials'>[];
  schedule: Tables<'service_schedule'> | null;
  accounts: Tables<'payment_accounts'>[];
  logs: WorkLog[];
  holidays: string[];
};

/** Estados en los que hay obra iniciada (jornadas, cierre). */
export const WORK_STATUSES: Enums<'service_status'>[] = ['in_progress', 'paused', 'under_review', 'completed'];
/** Estados con cotización aprobada (el cliente ve el resumen). */
export const APPROVED_STATUSES: Enums<'service_status'>[] = ['pending_payment', 'scheduled', ...WORK_STATUSES];

export function parseSlots(value: unknown): Slot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Slot => typeof v === 'object' && v !== null && typeof (v as Slot).date === 'string' && typeof (v as Slot).from === 'string'
  );
}

/** Primer pago del plan que lo pagado (verificado, aplicado en orden) aún no cubre, y cuánto le falta. */
export function nextUnpaidStage<T extends { amount: number }>(stages: T[], paidAmount: number): { stage: T; remaining: number } | null {
  let cumulative = 0;
  for (const stage of stages) {
    cumulative += Number(stage.amount);
    if (cumulative > paidAmount) return { stage, remaining: Math.min(Number(stage.amount), cumulative - paidAmount) };
  }
  return null;
}
