import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { RoleName } from '../../core/models/auth.models';
import { Shell } from './shell';

/**
 * El menú filtra por rol, así que la sesión simulada es de administrador: sin
 * ella las subsecciones restringidas no se dibujan.
 */
function authFalsa() {
  const usuario = {
    uuid: 'u-1',
    fullName: 'Mariana Ruiz',
    email: 'mariana@local.test',
    roleName: 'ADMIN' as RoleName,
    mustChangePassword: false,
  };

  return {
    user: signal(usuario),
    initials: signal('MR'),
    isAuthenticated: signal(true),
    sessionTimeoutMinutes: signal(15),
    hasRole: (...roles: RoleName[]) => roles.includes(usuario.roleName),
    logout: () => of(null),
    clear: () => undefined,
    verify: () => of(null),
  };
}

@Component({ template: 'vista' })
class Vista {}

/** Enlace de la barra lateral que corresponde a una ruta. */
function enlace(fixture: { nativeElement: HTMLElement }, ruta: string): HTMLElement | null {
  return fixture.nativeElement.querySelector(`a[href="${ruta}"]`);
}

describe('Shell · marcado de la barra lateral', () => {
  it('resalta la subsección activa y el grupo al que pertenece', async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authFalsa() },
        provideRouter([
          { path: 'inicio', component: Vista },
          { path: 'tipo-de-cambio', component: Vista },
          { path: 'factores', component: Vista },
        ]),
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Shell);

    await router.navigateByUrl('/tipo-de-cambio');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const gestion = enlace(fixture, '/tipo-de-cambio')!;
    const factores = enlace(fixture, '/factores')!;

    // La vista en curso queda marcada; su hermana no.
    expect(gestion.className).toContain('bg-brand-50');
    expect(gestion.className).toContain('text-brand-700');
    expect(gestion.getAttribute('aria-current')).toBe('page');

    expect(factores.className).not.toContain('bg-brand-50');
    expect(factores.getAttribute('aria-current')).toBeNull();

    // El encabezado del grupo también se resalta.
    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLElement[];
    const encabezado = botones.find((boton) => boton.textContent?.includes('Tipo de Cambio'))!;

    expect(encabezado.className).toContain('text-brand-600');

    // Al cambiar de subsección, el marcado se mueve con la navegación.
    await router.navigateByUrl('/factores');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(enlace(fixture, '/factores')!.className).toContain('bg-brand-50');
    expect(enlace(fixture, '/tipo-de-cambio')!.className).not.toContain('bg-brand-50');
  });

  it('despliega el grupo de la vista activa aunque estuviera cerrado', async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authFalsa() },
        provideRouter([{ path: 'factores', component: Vista }]),
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Shell);
    const componente = fixture.componentInstance as unknown as {
      toggleGroup(label: string): void;
      isCollapsed(label: string): boolean;
    };

    fixture.detectChanges();
    componente.toggleGroup('Tipo de Cambio');
    fixture.detectChanges();

    expect(componente.isCollapsed('Tipo de Cambio')).toBe(true);

    await router.navigateByUrl('/factores');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(componente.isCollapsed('Tipo de Cambio')).toBe(false);
    expect(enlace(fixture, '/factores')).not.toBeNull();
  });
});
