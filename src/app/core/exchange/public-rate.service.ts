import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../http/api.client';
import { PublicRateSnapshot } from '../models/public-rate.models';

/**
 * Consulta pública: un solo endpoint de lectura, sin sesión.
 *
 * No pasa por nada del área privada a propósito. Si esta llamada devuelve 401
 * alguna vez, es que se movió a una ruta protegida por error.
 */
@Injectable({ providedIn: 'root' })
export class PublicRateService {
  private readonly api = inject(ApiClient);

  snapshot(days = 30): Observable<PublicRateSnapshot> {
    return this.api.get<PublicRateSnapshot>('public/exchange-rate', { days });
  }
}
