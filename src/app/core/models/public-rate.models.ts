/**
 * Consulta pública del tipo de cambio.
 *
 * Es a propósito un modelo aparte y no una variante del tablero: lo que se
 * publica sin sesión no lleva origen del dato, ni capturas manuales, ni
 * identificadores. Si algo de eso hiciera falta aquí, el problema está en el
 * requisito, no en el tipo.
 */
export interface PublicRateChange {
  amount: string;
  percentage: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface PublicRatePoint {
  date: string;
  rate: string;
}

export interface PublicRateHistoryRow extends PublicRatePoint {
  change: PublicRateChange | null;
}

export interface PublicRateWindow {
  days: number;
  from: string | null;
  to: string | null;
  min: string | null;
  max: string | null;
}

export interface PublicRateSnapshot {
  available: boolean;
  currency: string;
  date?: string;
  rate?: string;
  /** Factor informativo del rango en el que cae el tipo de cambio del día. */
  factor?: string | null;
  change?: PublicRateChange | null;
  window: PublicRateWindow;
  points?: PublicRatePoint[];
  history?: PublicRateHistoryRow[];
}
