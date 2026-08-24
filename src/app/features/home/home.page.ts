import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardService } from '../../core/dashboard/dashboard.service';
import { ApiError } from '../../core/models/api.models';
import { ExchangeDashboard } from '../../core/models/dashboard.models';
import { Alert } from '../../shared/alert/alert';
import { Icon } from '../../shared/icon/icon';
import { FluctuationChart } from './fluctuation-chart';

/**
 * Resumen del Tipo de Cambio: valor vigente, día hábil siguiente, indicadores
 * del periodo y la gráfica de fluctuación.
 */
@Component({
  selector: 'app-home-page',
  imports: [DatePipe, RouterLink, Alert, Icon, FluctuationChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
})
export class HomePage {
  private readonly dashboard = inject(DashboardService);

  protected readonly data = signal<ExchangeDashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly today = computed(() => this.data()?.today ?? null);
  protected readonly nextDay = computed(() => this.data()?.nextBusinessDay ?? null);
  protected readonly manualEntries = computed(() => this.data()?.manualEntries ?? null);
  protected readonly process = computed(() => this.data()?.automaticProcess ?? null);
  protected readonly fluctuation = computed(() => this.data()?.fluctuation ?? null);

  /** «+0.0352» / «−0.0140», con el signo explícito. */
  protected readonly changeLabel = computed(() => {
    const change = this.today()?.change;

    if (!change) {
      return null;
    }

    const amount = Number(change.amount);
    const sign = amount > 0 ? '+' : '';

    return `${sign}${change.amount}`;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.dashboard.exchangeRate(30).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.errorMessage.set(error.message);
        this.loading.set(false);
      },
    });
  }
}
