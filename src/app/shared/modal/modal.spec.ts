import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Modal, ModalFooter } from './modal';

/** Modal con los botones por omisión. */
@Component({
  imports: [Modal],
  template: `
    @if (open()) {
      <app-modal title="Título" (closed)="closed = closed + 1" (confirmed)="confirmed = confirmed + 1">
        <input id="campo" />
      </app-modal>
    }
  `,
})
class DefaultHost {
  readonly open = signal(true);
  closed = 0;
  confirmed = 0;
}

/** Modal con pie propio. */
@Component({
  imports: [Modal, ModalFooter],
  template: `
    <app-modal title="Título">
      <p>Contenido</p>
      <div modalFooter><button type="button" id="propio">Guardar</button></div>
    </app-modal>
  `,
})
class CustomFooterHost {}

function backdrop(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement.querySelector('app-modal > div') as HTMLElement;
}

function panel(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
}

function pointer(type: string, target: HTMLElement): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true }));
}

describe('Modal', () => {
  describe('pie por omisión', () => {
    let fixture: ComponentFixture<DefaultHost>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({ imports: [DefaultHost] }).compileComponents();
      fixture = TestBed.createComponent(DefaultHost);
      fixture.detectChanges();
    });

    it('muestra Aceptar y Cancelar', () => {
      const botones = fixture.nativeElement.querySelectorAll('.btn-primary, .btn-ghost');
      expect(botones.length).toBe(2);
    });

    it('cierra con un clic limpio en el fondo', () => {
      const fondo = backdrop(fixture);
      pointer('pointerdown', fondo);
      pointer('pointerup', fondo);

      expect(fixture.componentInstance.closed).toBe(1);
    });

    it('NO cierra si el gesto empezó dentro del modal y terminó en el fondo', () => {
      // Es lo que ocurre al seleccionar el texto de un input y soltar fuera.
      pointer('pointerdown', fixture.nativeElement.querySelector('#campo') as HTMLElement);
      pointer('pointerup', backdrop(fixture));

      expect(fixture.componentInstance.closed).toBe(0);
    });

    it('NO cierra si el gesto empezó en el fondo y terminó dentro', () => {
      pointer('pointerdown', backdrop(fixture));
      pointer('pointerup', panel(fixture));

      expect(fixture.componentInstance.closed).toBe(0);
    });

    it('cierra con Escape y con la ✕', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.closed).toBe(1);

      (fixture.nativeElement.querySelector('[aria-label="Cerrar"]') as HTMLElement).click();
      expect(fixture.componentInstance.closed).toBe(2);
    });

    it('libera el desplazamiento del fondo al cerrarse', () => {
      expect(document.body.style.overflow).toBe('hidden');

      fixture.componentInstance.open.set(false);
      fixture.detectChanges();

      expect(document.body.style.overflow).not.toBe('hidden');
    });
  });

  describe('pie propio', () => {
    it('sustituye a los botones por omisión', async () => {
      await TestBed.configureTestingModule({ imports: [CustomFooterHost] }).compileComponents();
      const fixture = TestBed.createComponent(CustomFooterHost);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('#propio')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.btn-primary')).toBeNull();
      expect(fixture.nativeElement.querySelector('.btn-ghost')).toBeNull();
    });
  });
});
