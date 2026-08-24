import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../http/api.client';
import { Paginated } from '../models/api.models';
import {
  AuditEntry,
  ExchangeFactor,
  ExchangeRateFilters,
  ExchangeRateRow,
  FactorPayload,
  ManualRatePayload,
} from '../models/exchange.models';

@Injectable({ providedIn: 'root' })
export class ExchangeService {
  private readonly api = inject(ApiClient);

  // ----------------------------------------------------------------- factores

  factors(includeDeleted = false): Observable<ExchangeFactor[]> {
    return this.api.get<ExchangeFactor[]>('exchange-rates/factors', {
      includeDeleted: includeDeleted ? 1 : 0,
    });
  }

  createFactor(payload: FactorPayload): Observable<ExchangeFactor> {
    return this.api.post<ExchangeFactor>('exchange-rates/factors', payload);
  }

  updateFactor(uuid: string, payload: FactorPayload): Observable<ExchangeFactor> {
    return this.api.put<ExchangeFactor>(`exchange-rates/factors/${uuid}`, payload);
  }

  deleteFactor(uuid: string): Observable<ExchangeFactor> {
    return this.api.delete<ExchangeFactor>(`exchange-rates/factors/${uuid}`);
  }

  restoreFactor(uuid: string): Observable<ExchangeFactor> {
    return this.api.post<ExchangeFactor>(`exchange-rates/factors/${uuid}/restore`);
  }

  // ---------------------------------------------------------- tipos de cambio

  rates(filters: ExchangeRateFilters): Observable<Paginated<ExchangeRateRow>> {
    return this.api.get<Paginated<ExchangeRateRow>>('exchange-rates', {
      month: filters.month || null,
      source: filters.source || null,
      includeDeleted: filters.includeDeleted ? 1 : 0,
      page: filters.page ?? 1,
      perPage: filters.perPage ?? 20,
    });
  }

  /** Corrección manual: conserva el valor calculado y exige motivo. */
  setManualRate(uuid: string, payload: ManualRatePayload): Observable<ExchangeRateRow> {
    return this.api.put<ExchangeRateRow>(`exchange-rates/${uuid}`, payload);
  }

  deleteRate(uuid: string): Observable<ExchangeRateRow> {
    return this.api.delete<ExchangeRateRow>(`exchange-rates/${uuid}`);
  }

  /** Ejecuta la sincronización con Banxico bajo demanda. */
  sync(days?: number): Observable<{ processed: number; dates: string[] }> {
    return this.api.post<{ processed: number; dates: string[] }>('exchange-rates/sync', { days });
  }

  // ---------------------------------------------------------------- historial

  /** Movimientos de un registro concreto, tomados de la auditoría. */
  recordHistory(table: string, uuid: string): Observable<Paginated<AuditEntry>> {
    return this.api.get<Paginated<AuditEntry>>(`audit/records/${table}/${uuid}`, { perPage: 50 });
  }
}
