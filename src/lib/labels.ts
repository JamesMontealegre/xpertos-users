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
  in_progress: { label: 'En ejecución', tone: 'teal' },
  paused: { label: 'En pausa', tone: 'amber' },
  completed: { label: 'Finalizado', tone: 'green' },
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
    expert: 'El servicio está en ejecución. Márcalo como completado cuando termines.',
  },
  paused: {
    client: 'Xpertos pausó temporalmente tu servicio. Te avisaremos cuando se reanude.',
    expert: 'Xpertos pausó este servicio. No continúes el trabajo hasta que se reanude.',
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

type DocumentKindOption = {
  value: Enums<'document_kind'>;
  label: string;
  /** Obligatorio para que el operador apruebe la postulación. */
  required?: boolean;
  /** Se puede cargar más de un archivo de ese tipo. Los demás se cargan una sola vez. */
  repeatable?: boolean;
};

/** Orden del desplegable: primero los requeridos, luego los opcionales. */
export const documentKinds: DocumentKindOption[] = [
  { value: 'id_front', label: 'Cédula (frente)', required: true },
  { value: 'id_back', label: 'Cédula (reverso)', required: true },
  { value: 'social_security', label: 'Planilla de seguridad social y ARL', required: true },
  { value: 'photo', label: 'Foto 3x4 fondo blanco', required: true },
  { value: 'recommendation_letter', label: 'Carta de recomendación del último trabajo', required: true },
  { value: 'rut', label: 'RUT' },
  { value: 'background_check', label: 'Certificado de antecedentes' },
  { value: 'certificate', label: 'Certificado o diploma', repeatable: true },
  { value: 'portfolio', label: 'Portafolio de trabajos', repeatable: true },
  { value: 'other', label: 'Otro', repeatable: true },
];

/** Tipos que todavía se pueden elegir: los de una sola carga ya cargados salen del listado. */
export function availableDocumentKinds(uploaded: Enums<'document_kind'>[]) {
  return documentKinds.filter((k) => k.repeatable || !uploaded.includes(k.value));
}

/**
 * Siguiente tipo a sugerir después de cargar `after`: el próximo requerido pendiente (en el orden
 * de la lista, dando la vuelta); si no queda ninguno, el próximo opcional de una sola carga; si ya
 * están todos, el primer tipo repetible.
 */
export function nextDocumentKind(
  uploaded: Enums<'document_kind'>[],
  after: Enums<'document_kind'> | null
): Enums<'document_kind'> | null {
  const start = after ? documentKinds.findIndex((k) => k.value === after) + 1 : 0;
  const ordered = [...documentKinds.slice(start), ...documentKinds.slice(0, start)];
  const pendingRequired = ordered.find((k) => k.required && !uploaded.includes(k.value));
  const pendingOptional = ordered.find((k) => !k.required && !k.repeatable && !uploaded.includes(k.value));
  return pendingRequired?.value ?? pendingOptional?.value ?? availableDocumentKinds(uploaded)[0]?.value ?? null;
}

/** Documentos requeridos que el aspirante aún no ha cargado. */
export function missingDocumentKinds(uploaded: Enums<'document_kind'>[]) {
  return documentKinds.filter((k) => k.required && !uploaded.includes(k.value));
}

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
