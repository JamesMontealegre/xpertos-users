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
  assigned: { label: 'Asignado', tone: 'blue' },
  quoting: { label: 'En cotización', tone: 'amber' },
  pending_payment: { label: 'Pendiente de pago', tone: 'orange' },
  scheduled: { label: 'Programado', tone: 'blue' },
  in_progress: { label: 'En ejecución', tone: 'teal' },
  paused: { label: 'En pausa', tone: 'amber' },
  under_review: { label: 'En observación', tone: 'blue' },
  completed: { label: 'Finalizado', tone: 'green' },
  cancelled: { label: 'Cancelado', tone: 'red' },
};

export const serviceStatusHelp: Record<Enums<'service_status'>, { client: string; expert: string }> = {
  requested: {
    client: 'Recibimos tu solicitud. Xpertos elegirá al experto ideal para tu servicio y te avisaremos cuando quede asignado.',
    expert: 'La solicitud está pendiente de asignación por Xpertos.',
  },
  assigned: {
    client: 'Ya tienes experto asignado. Visitará o revisará el trabajo para preparar la cotización.',
    expert: 'Te asignaron este servicio. Revisa el trabajo, toma fotos del antes y envía tu cotización a Xpertos.',
  },
  quoting: {
    client: 'El experto envió la cotización y Xpertos la está revisando. Te avisaremos cuando esté lista para pago.',
    expert: 'En cotización: Xpertos está revisando tu cotización. Si hay algo por corregir te la devolverán con las notas.',
  },
  pending_payment: {
    client: 'Tu servicio fue revisado y está pendiente de pago. Paga en una de las cuentas de Xpertos y sube el comprobante.',
    expert: 'Xpertos aprobó la cotización. El cliente debe pagar; mientras tanto elige la periodicidad con la que quieres recibir tu pago.',
  },
  scheduled: {
    client: 'Pago confirmado. Tu servicio está programado; el experto llegará en la fecha de inicio.',
    expert: 'El pago del cliente fue confirmado. Prepárate para iniciar en la fecha programada.',
  },
  in_progress: {
    client: 'El experto está trabajando en tu servicio. Puedes ver aquí las jornadas que registra.',
    expert: 'El servicio está en ejecución. Registra cada jornada con horas y fotos; al terminar, cierra el trabajo.',
  },
  paused: {
    client: 'Xpertos pausó temporalmente tu servicio. Te avisaremos cuando se reanude.',
    expert: 'Xpertos pausó este servicio. No continúes el trabajo hasta que se reanude; tus jornadas quedan en solo lectura.',
  },
  under_review: {
    client: 'El experto terminó el trabajo. Revisa las jornadas y las fotos; Xpertos validará contigo que todo quedó bien.',
    expert: 'Cerraste el trabajo. Xpertos verificará con el cliente en máximo 1 día hábil y luego se libera tu pago.',
  },
  completed: {
    client: 'El servicio fue finalizado. ¡Cuéntanos cómo te fue!',
    expert: 'Servicio finalizado. Puedes calificar al cliente.',
  },
  cancelled: {
    client: 'Este servicio fue cancelado.',
    expert: 'Este servicio fue cancelado.',
  },
};

/** Pasos de la barra de avance. "En ejecución" y "En pausa" comparten el paso 6. */
export const lifecycleSteps: { key: string; label: string; statuses: Enums<'service_status'>[] }[] = [
  { key: 'requested', label: 'Solicitado', statuses: ['requested'] },
  { key: 'assigned', label: 'Asignado', statuses: ['assigned'] },
  { key: 'quoting', label: 'En cotización', statuses: ['quoting'] },
  { key: 'pending_payment', label: 'Pendiente de pago', statuses: ['pending_payment'] },
  { key: 'scheduled', label: 'Programado', statuses: ['scheduled'] },
  { key: 'running', label: 'En ejecución', statuses: ['in_progress', 'paused'] },
  { key: 'under_review', label: 'En observación', statuses: ['under_review'] },
  { key: 'completed', label: 'Finalizado', statuses: ['completed'] },
];

/** Índice (0-7) del paso de la barra para un estado; -1 si está cancelado. */
export function lifecycleIndex(status: Enums<'service_status'>): number {
  return lifecycleSteps.findIndex((step) => step.statuses.includes(status));
}

/** Estados desde los que el contrato es el de inicio ("acta de inicio") y se puede descargar. */
export const startedStatuses: Enums<'service_status'>[] = ['scheduled', 'in_progress', 'paused', 'under_review', 'completed'];

export const pricingModes: { value: Enums<'pricing_mode'>; label: string; short: string; description: string }[] = [
  {
    value: 'labor_only',
    label: 'Solo mano de obra',
    short: 'Solo mano de obra',
    description: 'El cliente compra los materiales que indiques. La obra inicia 2 días hábiles después del pago.',
  },
  {
    value: 'all_inclusive',
    label: 'Todo incluido (materiales + mano de obra)',
    short: 'Todo incluido',
    description: 'Tú suministras los materiales; Xpertos asigna su valor. La obra inicia 5 días hábiles después del pago.',
  },
];

export function pricingModeLabel(mode: Enums<'pricing_mode'> | null | undefined): string {
  return pricingModes.find((m) => m.value === mode)?.label ?? 'Solo mano de obra';
}

export const quoteStatus: Record<Enums<'quote_status'>, { label: string; tone: Tone }> = {
  draft: { label: 'Borrador', tone: 'slate' },
  submitted: { label: 'Enviada', tone: 'amber' },
  returned: { label: 'Devuelta', tone: 'orange' },
  approved: { label: 'Aprobada', tone: 'green' },
};

export const activityUnits = ['und', 'm²', 'ml', 'm³', 'global'];
export const materialUnits = ['und', 'm²', 'ml', 'm³', 'kg', 'galón', 'bulto', 'caja', 'global'];

export const payoutFrequencies: { value: Enums<'payout_frequency'>; label: string }[] = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'on_completion', label: 'Obra terminada' },
];

export function payoutFrequencyLabel(value: Enums<'payout_frequency'> | null | undefined): string {
  return payoutFrequencies.find((f) => f.value === value)?.label ?? 'Obra terminada';
}

export const payoutMethods: { value: Enums<'payout_method'>; label: string; description: string }[] = [
  { value: 'bank_account', label: 'Cuenta bancaria', description: 'Requiere certificación bancaria a tu nombre.' },
  { value: 'nequi', label: 'Nequi', description: 'Te pagamos al número Nequi que indiques.' },
  { value: 'efecty', label: 'Efectivo (Puntos Efecty)', description: 'Retiras en Efecty con tu nombre y cédula.' },
];

export function payoutMethodLabel(value: Enums<'payout_method'> | null | undefined): string {
  return payoutMethods.find((m) => m.value === value)?.label ?? 'Por definir';
}

/** Número Nequi válido: celular colombiano de 10 dígitos que empieza por 3. */
export function isValidNequi(value: string): boolean {
  return /^3\d{9}$/.test(value.replace(/\D/g, ''));
}

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
  /** Obligatorio solo con este medio de pago (p. ej. la certificación bancaria con cuenta bancaria). */
  requiredFor?: Enums<'payout_method'>;
  /** Se puede cargar más de un archivo de ese tipo. Los demás se cargan una sola vez. */
  repeatable?: boolean;
};

type PayoutMethod = Enums<'payout_method'> | null | undefined;

/** Orden del desplegable: primero los requeridos, luego los opcionales. */
export const documentKinds: DocumentKindOption[] = [
  { value: 'id_front', label: 'Cédula (frente)', required: true },
  { value: 'id_back', label: 'Cédula (reverso)', required: true },
  { value: 'social_security', label: 'Planilla de seguridad social y ARL', required: true },
  { value: 'photo', label: 'Foto 3x4 fondo blanco', required: true },
  { value: 'recommendation_letter', label: 'Carta de recomendación del último trabajo', required: true },
  { value: 'bank_certificate', label: 'Certificación bancaria', requiredFor: 'bank_account' },
  { value: 'rut', label: 'RUT' },
  { value: 'background_check', label: 'Certificado de antecedentes' },
  { value: 'certificate', label: 'Certificado o diploma', repeatable: true },
  { value: 'portfolio', label: 'Portafolio de trabajos', repeatable: true },
  { value: 'other', label: 'Otro', repeatable: true },
];

/** ¿El tipo es requerido con el medio de pago elegido? */
export function isRequiredKind(kind: DocumentKindOption, payoutMethod: PayoutMethod): boolean {
  return Boolean(kind.required || (kind.requiredFor && kind.requiredFor === payoutMethod));
}

/** Tipos con `required` resuelto según el medio de pago: los requeridos primero, en el orden de la lista. */
export function documentKindsFor(payoutMethod: PayoutMethod): (DocumentKindOption & { required: boolean })[] {
  const resolved = documentKinds.map((k) => ({ ...k, required: isRequiredKind(k, payoutMethod) }));
  return [...resolved.filter((k) => k.required), ...resolved.filter((k) => !k.required)];
}

/** Tipos que todavía se pueden elegir: los de una sola carga ya cargados salen del listado. */
export function availableDocumentKinds(uploaded: Enums<'document_kind'>[], payoutMethod: PayoutMethod = null) {
  return documentKindsFor(payoutMethod).filter((k) => k.repeatable || !uploaded.includes(k.value));
}

/**
 * Siguiente tipo a sugerir después de cargar `after`: el próximo requerido pendiente (en el orden
 * de la lista, dando la vuelta); si no queda ninguno, el próximo opcional de una sola carga; si ya
 * están todos, el primer tipo repetible.
 */
export function nextDocumentKind(
  uploaded: Enums<'document_kind'>[],
  after: Enums<'document_kind'> | null,
  payoutMethod: PayoutMethod = null
): Enums<'document_kind'> | null {
  const kinds = documentKindsFor(payoutMethod);
  const start = after ? kinds.findIndex((k) => k.value === after) + 1 : 0;
  const ordered = [...kinds.slice(start), ...kinds.slice(0, start)];
  const pendingRequired = ordered.find((k) => k.required && !uploaded.includes(k.value));
  const pendingOptional = ordered.find((k) => !k.required && !k.repeatable && !uploaded.includes(k.value));
  return pendingRequired?.value ?? pendingOptional?.value ?? availableDocumentKinds(uploaded, payoutMethod)[0]?.value ?? null;
}

/** Documentos requeridos que el aspirante aún no ha cargado. */
export function missingDocumentKinds(uploaded: Enums<'document_kind'>[], payoutMethod: PayoutMethod = null) {
  return documentKindsFor(payoutMethod).filter((k) => k.required && !uploaded.includes(k.value));
}

export function documentKindLabel(kind: Enums<'document_kind'>): string {
  return documentKinds.find((k) => k.value === kind)?.label ?? kind;
}

export const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const eventLabels: Record<string, string> = {
  status_change: 'Cambio de estado',
  assigned: 'Experto asignado',
  stage_created: 'Cobro creado',
  quote_submitted: 'Cotización enviada',
  quote_approved: 'Cotización aprobada',
  quote_returned: 'Cotización devuelta',
  payment_submitted: 'Comprobante enviado',
  payment_verified: 'Pago verificado',
  payment_rejected: 'Pago rechazado',
  payout_frequency_set: 'Periodicidad de pago elegida',
  contract_created: 'Contrato generado',
  contract_signed: 'Contrato firmado',
  work_closed: 'Trabajo cerrado',
  review_created: 'Calificación registrada',
};
