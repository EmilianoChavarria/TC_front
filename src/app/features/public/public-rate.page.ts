import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { PublicRateService } from '../../core/exchange/public-rate.service';
import { ApiError } from '../../core/models/api.models';
import { FluctuationPoint } from '../../core/models/dashboard.models';
import { PublicRateSnapshot } from '../../core/models/public-rate.models';
import { FluctuationChart } from '../../shared/chart/fluctuation-chart';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Consulta pública del tipo de cambio.
 *
 * ⚠️ Esta pantalla vive FUERA del marco de la aplicación: sin barra lateral,
 * sin menú de usuario y sin enlace al portal. Quien llega desde internet ve una
 * página de consulta y nada más; no hay pistas de que exista un sistema
 * administrativo detrás, y por eso tampoco se llama a ningún servicio del área
 * privada ni se lee el estado de sesión.
 */
@Component({
  selector: 'app-public-rate-page',
  imports: [FluctuationChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-rate.page.html',
})
export class PublicRatePage {
  private readonly rates = inject(PublicRateService);

  protected readonly snapshot = signal<PublicRateSnapshot | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly year = new Date().getFullYear();

  /** Fecha del valor vigente, escrita como se lee en voz alta. */
  protected readonly dateLabel = computed(() => {
    const date = this.snapshot()?.date;

    if (!date) {
      return '';
    }

    const [year, month, day] = date.split('-').map(Number);
    const local = new Date(year, month - 1, day);

    return `${DIAS[local.getDay()]} ${day} de ${MESES[month - 1]} de ${year}`;
  });

  /** Diferencia contra el día hábil anterior, con signo. */
  protected readonly changeLabel = computed(() => {
    const change = this.snapshot()?.change;

    if (!change) {
      return null;
    }

    const sign = change.direction === 'down' ? '' : '+';

    return `${sign}${change.amount} respecto al día hábil anterior`;
  });

  protected readonly direction = computed(() => this.snapshot()?.change?.direction ?? 'flat');

  /**
   * La gráfica es la misma del portal, así que se le entrega su forma de punto.
   * La serie de la publicación de origen va vacía y oculta: aquí sólo existe un
   * tipo de cambio.
   */
  protected readonly chartPoints = computed<FluctuationPoint[]>(() =>
    (this.snapshot()?.points ?? []).map((point) => ({
      date: point.date,
      effectiveRate: point.rate,
      publishedRate: null,
      publishedDate: null,
      source: 'automatic',
    })),
  );

  protected readonly history = computed(() => this.snapshot()?.history ?? []);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.rates.snapshot().subscribe({
      next: (snapshot) => {
        this.snapshot.set(snapshot);
        this.loading.set(false);
      },
      // El mensaje de error no distingue causas: quien consulta no tiene por
      // qué enterarse de si falló la red, el servidor o los datos.
      error: (_error: ApiError) => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  /** dd/mm/aaaa sin depender de la zona horaria del navegador. */
  protected shortDate(date: string): string {
    const [year, month, day] = date.split('-');

    return `${day}/${month}/${year}`;
  }

  protected signed(amount: string, direction: 'up' | 'down' | 'flat'): string {
    return direction === 'down' ? amount : `+${amount}`;
  }
}
