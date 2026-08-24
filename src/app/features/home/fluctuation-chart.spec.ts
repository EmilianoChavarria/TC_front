import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FluctuationPoint } from '../../core/models/dashboard.models';
import { FluctuationChart } from './fluctuation-chart';

@Component({
  imports: [FluctuationChart],
  template: '<app-fluctuation-chart [points]="points()" />',
})
class Host {
  readonly points = signal<FluctuationPoint[]>([]);
}

function punto(date: string, effective: string, published: string): FluctuationPoint {
  return {
    date,
    effectiveRate: effective,
    publishedRate: published,
    publishedDate: date,
    source: 'automatic',
  };
}

/** El recorte que descubre el trazo vive en el contenedor de líneas y puntos. */
function revealed(fixture: ComponentFixture<unknown>): string {
  const capa = fixture.nativeElement.querySelector('[style*="clip-path"]') as HTMLElement | null;

  return capa?.style.clipPath ?? '';
}

describe('FluctuationChart', () => {
  it('reparte los puntos y respeta el orden vertical de los valores', async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.points.set([
      punto('2026-08-03', '18.50', '18.40'),
      punto('2026-08-04', '19.00', '18.90'),
      punto('2026-08-05', '18.75', '18.65'),
    ]);
    fixture.detectChanges();

    const dots = Array.from(
      fixture.nativeElement.querySelectorAll('span.rounded-full'),
    ) as HTMLElement[];

    expect(dots.length).toBe(3);

    // Reparto horizontal uniforme, de extremo a extremo.
    expect(dots.map((dot) => dot.style.left)).toEqual(['0%', '50%', '100%']);

    // El eje vertical crece hacia abajo: el valor mayor queda más arriba.
    const y = dots.map((dot) => parseFloat(dot.style.top));
    expect(y[1]).toBeLessThan(y[2]);
    expect(y[2]).toBeLessThan(y[0]);

    // Con margen, ninguna serie toca los bordes del área.
    expect(Math.min(...y)).toBeGreaterThan(0);
    expect(Math.max(...y)).toBeLessThan(100);
  });

  it('une los puntos con curvas que no se pasan de los valores reales', async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.points.set([
      punto('2026-08-03', '18.50', '18.40'),
      punto('2026-08-04', '19.00', '18.90'),
      punto('2026-08-05', '18.75', '18.65'),
      punto('2026-08-06', '18.60', '18.50'),
    ]);
    fixture.detectChanges();

    const trazo = (
      fixture.nativeElement.querySelector('path[stroke="#ff8200"]') as SVGPathElement
    ).getAttribute('d')!;

    // Curvas cúbicas, no segmentos rectos.
    expect(trazo).toContain('C');
    expect(trazo).not.toContain('L');

    // Ningún punto de control se sale del área: sin rebotes inventados.
    const numeros = trazo.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const verticales = numeros.filter((_, indice) => indice % 2 === 1);

    expect(Math.min(...verticales)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...verticales)).toBeLessThanOrEqual(100);
  });

  it('avisa cuando no hay datos en el periodo', async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Aún no hay tipos de cambio');
  });

  describe('trazado al cargar', () => {
    it('arranca recortado y descubre el área de izquierda a derecha', async () => {
      await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

      const fixture = TestBed.createComponent(Host);
      fixture.componentInstance.points.set([
        punto('2026-08-03', '18.50', '18.40'),
        punto('2026-08-04', '19.00', '18.90'),
      ]);
      fixture.detectChanges();

      // Al inicio sólo se ve el extremo izquierdo.
      expect(revealed(fixture)).toBe('inset(0 100% 0 0)');

      await new Promise((resolve) => setTimeout(resolve, 1600));
      fixture.detectChanges();

      // Terminada la animación, el área queda descubierta por completo.
      expect(revealed(fixture)).toBe('inset(0 0% 0 0)');
    });

    it('respeta la preferencia de menos movimiento', async () => {
      const original = window.matchMedia;
      window.matchMedia = ((query: string) =>
        ({ matches: query.includes('prefers-reduced-motion'), media: query })) as typeof matchMedia;

      try {
        await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

        const fixture = TestBed.createComponent(Host);
        fixture.componentInstance.points.set([punto('2026-08-03', '18.50', '18.40')]);
        fixture.detectChanges();

        // Sin animación: el trazo aparece completo desde el primer momento.
        expect(revealed(fixture)).toBe('inset(0 0% 0 0)');
      } finally {
        window.matchMedia = original;
      }
    });
  });
});
