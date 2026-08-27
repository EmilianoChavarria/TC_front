/** Día inhábil del calendario bancario. */
export interface Holiday {
  uuid: string;
  holidayDate: string;
  year: number;
  description: string;
  isDeleted: boolean;
  status: 'active' | 'deleted';
  statusLabel: string;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

export interface HolidayPayload {
  holidayDate: string;
  description: string;
}

/** Elemento del guardado por lote; con `uuid` actualiza, sin él da de alta. */
export interface BulkHolidayItem extends HolidayPayload {
  uuid?: string | null;
}

export interface BulkHolidaysResult {
  saved: Holiday[];
  holidays: Holiday[];
}

/**
 * Cobertura del calendario.
 *
 * `pendingYear` es el año que aún no tiene ni un día capturado; mientras exista,
 * el backend manda el recordatorio diario a partir de `reminderStartsOn`.
 */
export interface HolidayStatus {
  years: { year: number; total: number; captured: boolean }[];
  currentYear: number;
  nextYear: number;
  pendingYear: number | null;
  reminderActive: boolean;
  reminderStartsOn: string;
}
