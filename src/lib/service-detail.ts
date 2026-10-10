import type { WorkLog } from '@/components/service/work-logs';
import type { Enums, Tables } from '@/lib/database.types';

export type Slot = { date: string; from: string; to: string };

/** Todo lo que carga la pantalla de detalle de un servicio. */
export type ServiceDetail = {
  service: Tables<'services'> & { service_categories: { name: string } | null };
  photos: Tables<'service_photos'>[];
  stages: Tables<'service_stages'>[];
  payments: Tables<'payments'>[];
  contract: Tables<'contracts'> | null;
  signatures: Tables<'contract_signatures'>[];
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
