import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../http/api.client';
import {
  BulkHolidayItem,
  BulkHolidaysResult,
  Holiday,
  HolidayPayload,
  HolidayStatus,
} from '../models/holiday.models';

@Injectable({ providedIn: 'root' })
export class HolidaysService {
  private readonly api = inject(ApiClient);

  list(year: number, includeDeleted = false): Observable<Holiday[]> {
    return this.api.get<Holiday[]>('holidays', {
      year,
      includeDeleted: includeDeleted ? 1 : 0,
    });
  }

  /** Años cubiertos y si falta capturar el siguiente. */
  status(): Observable<HolidayStatus> {
    return this.api.get<HolidayStatus>('holidays/status');
  }

  create(payload: HolidayPayload): Observable<Holiday> {
    return this.api.post<Holiday>('holidays', payload);
  }

  /**
   * Calendario completo de un año en una sola operación.
   *
   * Es todo o nada en el backend: una fecha mal escrita en la línea 12 no
   * guarda las once anteriores. Se prefiere así a dejar el año a medias sin
   * que se note cuál falta.
   */
  saveMany(holidays: BulkHolidayItem[]): Observable<BulkHolidaysResult> {
    return this.api.post<BulkHolidaysResult>('holidays/bulk', { holidays });
  }

  update(uuid: string, payload: Partial<HolidayPayload>): Observable<Holiday> {
    return this.api.put<Holiday>(`holidays/${uuid}`, payload);
  }

  /** Baja lógica: la fecha puede volver a darse de alta después. */
  delete(uuid: string): Observable<Holiday> {
    return this.api.delete<Holiday>(`holidays/${uuid}`);
  }

  restore(uuid: string): Observable<Holiday> {
    return this.api.post<Holiday>(`holidays/${uuid}/restore`);
  }
}
