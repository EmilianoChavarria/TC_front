import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { FactorsPage } from './factors.page';

/**
 * Las entradas replican lo que la auditoría guarda de verdad: el alta trae el
 * registro completo y las ediciones sólo las columnas que cambiaron.
 */
const HISTORIAL = {
  data: [
    {
      uuid: 'a-3',
      event: 'updated',
      eventLabel: 'Actualización',
      table: 'exchangeratefactors',
      recordUuid: 'f-1',
      recordLabel: 'Clave 1',
      changedColumns: ['rangeTo', 'updatedAt'],
      oldValues: { rangeTo: '15.670000', updatedAt: '2026-08-24 21:17:40' },
      newValues: { rangeTo: 15.68, updatedAt: '2026-08-24 21:23:18' },
      actorName: 'Super Administrador',
      actorRole: 'SUPERADMIN',
      occurredAt: '2026-08-24T21:23:18+00:00',
    },
    {
      uuid: 'a-2',
      event: 'softDeleted',
      eventLabel: 'Eliminación lógica',
      table: 'exchangeratefactors',
      recordUuid: 'f-1',
      recordLabel: 'Clave 1',
      changedColumns: ['deletedAt', 'updatedAt'],
      oldValues: { deletedAt: null },
      newValues: { deletedAt: '2026-08-24 21:24:00' },
      actorName: 'Mariana Ruiz',
      actorRole: 'ADMIN',
      occurredAt: '2026-08-24T21:24:00+00:00',
    },
    {
      uuid: 'a-1',
      event: 'created',
      eventLabel: 'Alta',
      table: 'exchangeratefactors',
      recordUuid: 'f-1',
      recordLabel: 'Clave 1',
      changedColumns: null,
      oldValues: null,
      newValues: { code: 1, factor: 0.7, rangeFrom: 0, rangeTo: 15.68 },
      actorName: 'Super Administrador',
      actorRole: 'SUPERADMIN',
      occurredAt: '2026-08-24T21:16:39+00:00',
    },
  ],
  current_page: 1,
  last_page: 1,
  per_page: 50,
  total: 3,
};

function envelope(data: unknown) {
  return { codeStatus: 200, success: true, message: 'ok', data, errors: null, timestamp: '' };
}

describe('FactorsPage · historial por factor', () => {
  it('traduce cada movimiento con la precisión de cada campo', async () => {
    await TestBed.configureTestingModule({
      imports: [FactorsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(FactorsPage);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http.expectOne((r) => r.url === `${environment.apiUrl}/exchange-rates/factors`).flush(
      envelope([]),
    );

    const componente = fixture.componentInstance as unknown as {
      openHistory(factor: { uuid: string }): void;
      history(): { title: string; detail: string; actorName: string }[];
    };

    componente.openHistory({ uuid: 'f-1' });

    http
      .expectOne(`${environment.apiUrl}/audit/records/exchangeratefactors/f-1?perPage=50`)
      .flush(envelope(HISTORIAL));

    const entradas = componente.history();

    expect(entradas.map((e) => e.title)).toEqual([
      'Actualización de factor',
      'Eliminación lógica',
      'Alta de factor',
    ]);

    // Sólo la columna que cambió, con 4 decimales por ser un tipo de cambio.
    expect(entradas[0].detail).toBe('Hasta: 15.6700 → 15.6800');

    // La baja lógica se lee como estado, no como fecha.
    expect(entradas[1].detail).toBe('Estado: Vigente → Eliminado');

    // El alta trae el factor con 3 decimales y el rango con 4.
    expect(entradas[2].detail).toBe('Valor inicial 0.700 · rango 0.0000 a 15.6800');

    http.verify();
  });
});
