import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { FluctuationPoint } from '../../core/models/dashboard.models';

interface PlottedPoint {
  index: number;
  /** Posición horizontal en porcentaje del ancho útil. */
  x: number;
  /** Posición vertical del tipo de cambio, en porcentaje desde arriba. */
  effectiveY: number | null;
  publishedY: number | null;
  label: string;
  date: string;
  effectiveRate: string | null;
  publishedRate: string | null;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Gráfica de fluctuación: línea naranja del tipo de cambio vigente y línea
 * gris punteada de la publicación de Banxico.
 *
 * Las líneas van en SVG estirado (`preserveAspectRatio="none"`) con trazo de
 * grosor constante; los puntos, etiquetas y la información al pasar el ratón son
 * HTML posicionado en porcentajes, así no se deforman con el ancho.
 *
 * Al cargar, el trazo se descubre de izquierda a derecha recortando el área con
 * `clip-path`. Se anima el recorte y no la longitud del trazo porque el SVG va
 * estirado: `stroke-dasharray` mediría en unidades deformadas y el avance no
 * sería uniforme. Además el recorte descubre líneas y puntos a la vez.
 */
@Component({
  selector: 'app-fluctuation-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fluctuation-chart.html',
})
export class FluctuationChart {
  readonly points = input.required<FluctuationPoint[]>();

  protected readonly hovered = signal<number | null>(null);

  /** Avance del trazado, de 0 a 100. */
  private readonly progress = signal(0);

  /** Recorte que descubre el área conforme avanza la animación. */
  protected readonly reveal = computed(() => `inset(0 ${100 - this.progress()}% 0 0)`);

  private frame: number | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());

    // Cada vez que llegan datos nuevos el trazo se vuelve a dibujar.
    effect(() => {
      const total = this.points().length;
      this.animate(total);
    });
  }

  private animate(total: number): void {
    this.cancel();

    // Sin datos, o si el usuario pidió menos movimiento, se muestra completo.
    if (total === 0 || this.prefersReducedMotion()) {
      this.progress.set(100);
      return;
    }

    const duration = 1400;
    const start = performance.now();
    this.progress.set(0);

    // Se mide con performance.now() y no con la marca que entrega el
    // requestAnimationFrame: no siempre comparten origen de tiempo, y una
    // diferencia negativa haría que el avance se saliera del rango.
    const step = (): void => {
      const elapsed = Math.min(1, Math.max(0, (performance.now() - start) / duration));
      // easeInOutCubic: entra y sale suave, sin el tirón inicial del easeOut.
      const eased =
        elapsed < 0.5 ? 4 * elapsed ** 3 : 1 - Math.pow(-2 * elapsed + 2, 3) / 2;

      this.progress.set(eased * 100);

      this.frame = elapsed < 1 ? requestAnimationFrame(step) : null;
    };

    this.frame = requestAnimationFrame(step);
  }

  private cancel(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Escala vertical con un margen para que las líneas no toquen los bordes. */
  private readonly bounds = computed(() => {
    const values = this.points()
      .flatMap((point) => [point.effectiveRate, point.publishedRate])
      .filter((value): value is string => value !== null)
      .map(Number);

    if (values.length === 0) {
      return { min: 0, max: 1 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min || 1) * 0.15;

    return { min: min - padding, max: max + padding };
  });

  protected readonly plotted = computed<PlottedPoint[]>(() => {
    const points = this.points();
    const { min, max } = this.bounds();
    const span = max - min || 1;
    const step = points.length > 1 ? 100 / (points.length - 1) : 0;

    const toY = (value: string | null): number | null =>
      value === null ? null : ((max - Number(value)) / span) * 100;

    return points.map((point, index) => ({
      index,
      x: points.length > 1 ? index * step : 50,
      effectiveY: toY(point.effectiveRate),
      publishedY: toY(point.publishedRate),
      label: this.shortDate(point.date),
      date: this.longDate(point.date),
      effectiveRate: point.effectiveRate,
      publishedRate: point.publishedRate,
    }));
  });

  protected readonly effectivePath = computed(() => this.path('effectiveY'));
  protected readonly publishedPath = computed(() => this.path('publishedY'));

  /** Tres referencias verticales: máximo, punto medio y mínimo. */
  protected readonly axisValues = computed(() => {
    const { min, max } = this.bounds();

    return [max, (max + min) / 2, min].map((value) => value.toFixed(2));
  });

  /** Con muchos puntos se rotula uno de cada n para que no se encimen. */
  protected readonly labelStep = computed(() => Math.ceil(this.plotted().length / 16));

  protected readonly active = computed(() => {
    const index = this.hovered();

    return index === null ? null : (this.plotted()[index] ?? null);
  });

  protected onMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const { left, width } = target.getBoundingClientRect();
    const total = this.plotted().length;

    if (total === 0 || width === 0) {
      return;
    }

    const ratio = Math.min(1, Math.max(0, (event.clientX - left) / width));
    this.hovered.set(Math.round(ratio * (total - 1)));
  }

  protected onLeave(): void {
    this.hovered.set(null);
  }

  protected showLabel(index: number): boolean {
    const step = this.labelStep();

    return index % step === 0 || index === this.plotted().length - 1;
  }

  /** Mantiene el recuadro dentro del área cuando el punto está cerca del borde. */
  protected tooltipShift(x: number): string {
    if (x < 20) {
      return '0%';
    }

    return x > 80 ? '-100%' : '-50%';
  }

  /**
   * Trazo curvo en vez de quebrado: cada tramo es una curva cúbica con los
   * puntos de control derivados de los vecinos (Catmull-Rom). Los controles se
   * acotan al rango vertical del tramo para que la curva no se pase de los
   * valores reales: en una serie de tipos de cambio, un rebote inventado
   * dibujaría un máximo que nunca existió.
   */
  private path(key: 'effectiveY' | 'publishedY'): string {
    const points = this.plotted()
      .filter((point) => point[key] !== null)
      .map((point) => ({ x: point.x, y: point[key] as number }));

    if (points.length === 0) {
      return '';
    }

    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    const segments = [`M ${this.round(points[0].x)} ${this.round(points[0].y)}`];

    for (let i = 0; i < points.length - 1; i++) {
      const previous = points[i - 1] ?? points[i];
      const current = points[i];
      const next = points[i + 1];
      const following = points[i + 2] ?? next;

      const lower = Math.min(current.y, next.y);
      const upper = Math.max(current.y, next.y);
      const clamp = (value: number): number => Math.min(upper, Math.max(lower, value));

      const control1X = current.x + (next.x - previous.x) / 6;
      const control1Y = clamp(current.y + (next.y - previous.y) / 6);
      const control2X = next.x - (following.x - current.x) / 6;
      const control2Y = clamp(next.y - (following.y - current.y) / 6);

      segments.push(
        `C ${this.round(control1X)} ${this.round(control1Y)}` +
          ` ${this.round(control2X)} ${this.round(control2Y)}` +
          ` ${this.round(next.x)} ${this.round(next.y)}`,
      );
    }

    return segments.join(' ');
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private shortDate(date: string): string {
    const [, month, day] = date.split('-');

    return `${day} ${MESES[Number(month) - 1]}`;
  }

  private longDate(date: string): string {
    const [year, month, day] = date.split('-');

    return `${day}/${month}/${year}`;
  }
}
