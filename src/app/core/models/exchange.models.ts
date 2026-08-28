import { RateSource } from './dashboard.models';

/** Rango de la publicación de Banxico con su factor: [rangeFrom, rangeTo). */
export interface ExchangeFactor {
  uuid: string;
  code: number;
  rangeFrom: string;
  rangeTo: string;
  factor: string;
  updatedBy: string | null;
  isDeleted: boolean;
  status: 'active' | 'deleted';
  statusLabel: string;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

export interface FactorPayload {
  rangeFrom: number;
  rangeTo: number;
  factor: number;
}

/** Fila de «Gestión de Tipo de Cambio». */
export interface ExchangeRateRow {
  uuid: string;
  applicableDate: string;
  dayTag: 'today' | 'next' | null;
  publishedRate: string | null;
  publishedDate: string | null;
  /** Día feriado: fecha de la que se arrastró el tipo de cambio vigente. */
  carriedFromDate: string | null;
  isCarried: boolean;
  factorCode: number | null;
  factorValue: string | null;
  factorApplied: boolean;
  calculatedRate: string | null;
  manualRate: string | null;
  effectiveRate: string | null;
  source: RateSource;
  sourceLabel: string;
  manualReason: string | null;
  manualSetAt: string | null;
  lastModifiedBy: string;
  lastModifiedAt: string | null;
  isEditable: boolean;
  isDeleted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ExchangeRateFilters {
  month?: string;
  source?: RateSource | '';
  includeDeleted?: boolean;
  page?: number;
  perPage?: number;
}

export interface ManualRatePayload {
  manualRate: number;
  reason: string;
}

/** Entrada del historial, derivada de la auditoría. */
export interface AuditEntry {
  uuid: string;
  event: string;
  eventLabel: string;
  table: string;
  recordUuid: string | null;
  recordLabel: string | null;
  changedColumns: string[] | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  actorName: string;
  actorRole: string | null;
  occurredAt: string | null;
  /** Solicitud que originó el cambio; permite agrupar los rastros de una misma acción. */
  request?: { uuid: string; method: string; path: string; statusCode: number | null } | null;
}
