import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../http/api.client';
import { ExchangeDashboard, Fluctuation } from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiClient);

  /** Tarjetas y serie en una sola llamada. */
  exchangeRate(days = 30): Observable<ExchangeDashboard> {
    return this.api.get<ExchangeDashboard>('dashboard/exchange-rate', { days });
  }

  /** Sólo la serie, para cambiar la ventana sin recargar las tarjetas. */
  fluctuation(days = 30): Observable<Fluctuation> {
    return this.api.get<Fluctuation>('dashboard/exchange-rate/fluctuation', { days });
  }
}
