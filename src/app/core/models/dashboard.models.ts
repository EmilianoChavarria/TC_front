export type RateSource = 'automatic' | 'manual';

export interface RateChange {
  amount: string;
  percentage: number | null;
  direction: 'up' | 'down' | 'flat';
  comparedTo: string;
  comparedToRate: string | null;
}

/** Tarjeta del tipo de cambio vigente. */
export interface TodayCard {
  available: boolean;
  date: string;
  dateLabel: string;
  effectiveRate?: string | null;
  publishedRate?: string | null;
  publishedDate?: string | null;
  factorCode?: number | null;
  factorValue?: string | null;
  factorApplied?: boolean;
  source?: RateSource;
  sourceLabel?: string;
  change?: RateChange | null;
}

/** Tarjeta del día hábil siguiente. */
export interface NextBusinessDayCard {
  available: boolean;
  date: string;
  dateLabel: string;
  effectiveRate?: string | null;
  publishedRate?: string | null;
  publishedDate?: string | null;
  factorCode?: number | null;
  factorValue?: string | null;
  factorApplied?: boolean;
  source?: RateSource;
  sourceLabel?: string;
  calculatedAt?: string | null;
}

export interface ManualEntries {
  days: number;
  total: number;
}

export interface AutomaticProcess {
  status: 'executed' | 'failed' | 'pending';
  statusLabel: string;
  ranAt: string | null;
  ranToday: boolean;
  processed?: number | null;
  error?: string | null;
}

export interface FluctuationPoint {
  date: string;
  effectiveRate: string | null;
  publishedRate: string | null;
  publishedDate: string | null;
  source: RateSource;
}

export interface Fluctuation {
  days: number;
  from: string;
  to: string;
  series: { effectiveRate: string; publishedRate: string };
  points: FluctuationPoint[];
  min: string | null;
  max: string | null;
}

export interface ExchangeDashboard {
  currency: string;
  today: TodayCard;
  nextBusinessDay: NextBusinessDayCard;
  manualEntries: ManualEntries;
  automaticProcess: AutomaticProcess;
  fluctuation: Fluctuation;
}
