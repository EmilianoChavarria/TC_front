import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { RatesPage } from './rates.page';

const SOLICITUD = { uuid: 'req-1', method: 'PUT', path: 'api/exchange-rates/r-1', statusCode: 200 };

/**
 * Replica lo que la auditoría guarda de una corrección manual: el evento de
 * dominio con el motivo y, por la misma solicitud, el cambio del modelo.
 */
const HISTORIAL = {
  data: [
    {
      uuid: 'a-3',
      event: 'exchangeRate.manualOverride',
      eventLabel: 'exchangeRate.manualOverride',
      table: 'exchangerates',
      recordUuid: 'r-1',
      recordLabel: '2026-08-25',
      changedColumns: null,
      oldValues: null,
      newValues: {
        previousManualRate: null,
        manualRate: '13.1477',
        calculatedRate: '13.1476',
        reason: 'Mal cálculo',
      },
      actorName: 'Super Administrador',
      actorRole: 'SUPERADMIN',
      occurredAt: '2026-08-24T15:35:00+00:00',
      request: SOLICITUD,
    },
    {
      uuid: 'a-2',
      event: 'updated',
      eventLabel: 'Actualización',
      table: 'exchangerates',
      recordUuid: 'r-1',
      recordLabel: '2026-08-25',
      changedColumns: ['manualRate', 'effectiveRate', 'source', 'manualReason'],
      oldValues: { manualRate: null, effectiveRate: '13.147600' },
      newValues: { manualRate: '13.147700', effectiveRate: '13.147700' },
      actorName: 'Super Administrador',
      actorRole: 'SUPERADMIN',
      occurredAt: '2026-08-24T15:35:00+00:00',
      request: SOLICITUD,
    },
    {
      uuid: 'a-1',
      event: 'created',
      eventLabel: 'Alta',
      table: 'exchangerates',
      recordUuid: 'r-1',
      recordLabel: '2026-08-25',
      changedColumns: null,
      oldValues: null,
      newValues: {
        effectiveRate: '13.1476',
        publishedRate: '16.9647',
        publishedDate: '2026-08-24 00:00:00',
        factorValue: '0.775000',
      },
      actorName: 'Proceso automático',
      actorRole: null,
      occurredAt: '2026-08-24T15:18:00+00:00',
      request: null,
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

describe('RatesPage · historial del tipo de cambio', () => {
  it('muestra el valor anterior, la precisión correcta y sin línea duplicada', async () => {
    await TestBed.configureTestingModule({
      imports: [RatesPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(RatesPage);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http
      .expectOne((r) => r.url === `${environment.apiUrl}/exchange-rates`)
      .flush(envelope({ data: [], current_page: 1, last_page: 1, per_page: 20, total: 0 }));

    const componente = fixture.componentInstance as unknown as {
      openHistory(row: { uuid: string }): void;
      history(): { title: string; detail: string }[];
    };

    componente.openHistory({ uuid: 'r-1' });

    http
      .expectOne(`${environment.apiUrl}/audit/records/exchangerates/r-1?perPage=50`)
      .flush(envelope(HISTORIAL));

    const entradas = componente.history();

    // El cambio de modelo de la misma solicitud no se repite: lo cuenta la corrección.
    expect(entradas.map((e) => e.title)).toEqual([
      'Corrección manual',
      'Cálculo automático del sistema',
    ]);

    // Se ve de qué valor se venía, aunque no hubiera captura manual previa ni
    // el dato en el evento: se recupera del rastro del modelo.
    expect(entradas[0].detail).toBe(
      '13.1476 → 13.1477 · Calculado por el sistema: 13.1476 · Motivo: Mal cálculo',
    );

    // Tipo de cambio con 4 decimales y factor con 3.
    expect(entradas[1].detail).toBe(
      '— → 13.1476 · Publicación Banxico 16.9647 (2026-08-24) · factor 0.775',
    );

    http.verify();
  });
});
