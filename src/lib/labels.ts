import { colors } from '@/constants/theme';

import type { Enums } from './database.types';

export type Tone = 'slate' | 'amber' | 'blue' | 'teal' | 'green' | 'red' | 'orange';

export const toneColors: Record<Tone, { bg: string; fg: string }> = {
  slate: { bg: colors.slateSoft, fg: colors.slate },
  amber: { bg: colors.warningSoft, fg: colors.warning },
  blue: { bg: colors.infoSoft, fg: colors.info },
  teal: { bg: colors.primarySoft, fg: colors.primary },
  green: { bg: colors.successSoft, fg: colors.success },
  red: { bg: colors.dangerSoft, fg: colors.danger },
  orange: { bg: colors.accentSoft, fg: colors.accent },
};

export const serviceStatus: Record<Enums<'service_status'>, { label: string; tone: Tone }> = {
  requested: { label: 'Solicitado', tone: 'slate' },
  in_review: { label: 'En revisión', tone: 'amber' },
  assigned: { label: 'Asignado', tone: 'blue' },
  in_progress: { label: 'En progreso', tone: 'teal' },
  completed: { label: 'Completado', tone: 'green' },
  cancelled: { label: 'Cancelado', tone: 'red' },
};

export const serviceStatusHelp: Record<Enums<'service_status'>, { client: string; expert: string }> = {
  requested: {
    client: 'Recibimos tu solicitud. Un operador de Xpertos la revisará y te asignará un experto.',
    expert: 'La solicitud está pendiente de revisión por Xpertos.',
  },
  in_review: {
    client: 'Estamos revisando tu solicitud y buscando el experto ideal. Te avisaremos cuando quede asignado.',
    expert: 'Xpertos está revisando esta solicitud.',
  },
  assigned: {
    client:
      'Ya tienes experto asignado. Revisa y firma el contrato y paga el anticipo para que el trabajo pueda iniciar.',
    expert:
      'Te asignaron este servicio. Revisa y firma el contrato; cuando el anticipo esté verificado podrás iniciarlo.',
  },
  in_progress: {
    client: 'El experto está trabajando en tu servicio. Cuando termine, podrás calificarlo.',
    expert: 'El servicio está en progreso. Márcalo como completado cuando termines.',
  },
  completed: {
    client: 'El servicio fue completado. ¡Cuéntanos cómo te fue!',
    expert: 'Servicio completado. Puedes calificar al cliente.',
  },
  cancelled: {
    client: 'Esta solicitud fue cancelada.',
    expert: 'Este servicio fue cancelado.',
  },
};

export const stageStatus: Record<Enums<'stage_status'>, { label: string; tone: Tone }> = {
  pending: { label: 'Pendiente', tone: 'slate' },
  awaiting_payment: { label: 'Por pagar', tone: 'amber' },
  proof_uploaded: { label: 'Comprobante enviado', tone: 'blue' },
  paid: { label: 'Pagado', tone: 'green' },
  rejected: { label: 'Rechazado', tone: 'red' },
};

export const paymentStatus: Record<Enums<'payment_status'>, { label: string; tone: Tone }> = {
  submitted: { label: 'En verificación', tone: 'amber' },
  verified: { label: 'Verificado', tone: 'green' },
  rejected: { label: 'Rechazado', tone: 'red' },
};

export const applicationStatus: Record<Enums<'application_status'>, { label: string; tone: Tone }> = {
  pending: { label: 'Pendiente', tone: 'slate' },
  in_review: { label: 'En revisión', tone: 'amber' },
  needs_info: { label: 'Falta información', tone: 'orange' },
  approved: { label: 'Aprobada', tone: 'green' },
  rejected: { label: 'Rechazada', tone: 'red' },
};

export const contractStatus: Record<Enums<'contract_status'>, { label: string; tone: Tone }> = {
  draft: { label: 'Borrador', tone: 'slate' },
  pending_signatures: { label: 'Pendiente de firmas', tone: 'amber' },
  signed: { label: 'Firmado', tone: 'green' },
  void: { label: 'Anulado', tone: 'red' },
};

export const documentKinds: { value: Enums<'document_kind'>; label: string }[] = [
  { value: 'id_front', label: 'Cédula (frente)' },
  { value: 'id_back', label: 'Cédula (reverso)' },
  { value: 'rut', label: 'RUT' },
  { value: 'certificate', label: 'Certificado o diploma' },
  { value: 'portfolio', label: 'Portafolio de trabajos' },
  { value: 'background_check', label: 'Certificado de antecedentes' },
  { value: 'social_security', label: 'Planilla de seguridad social' },
  { value: 'other', label: 'Otro' },
];

export function documentKindLabel(kind: Enums<'document_kind'>): string {
  return documentKinds.find((k) => k.value === kind)?.label ?? kind;
}

export const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const eventLabels: Record<string, string> = {
  status_change: 'Cambio de estado',
  assigned: 'Experto asignado',
  stage_created: 'Etapa creada',
  payment_submitted: 'Comprobante enviado',
  payment_verified: 'Pago verificado',
  payment_rejected: 'Pago rechazado',
  contract_created: 'Contrato generado',
  contract_signed: 'Contrato firmado',
  review_created: 'Calificación registrada',
};
