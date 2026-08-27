import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** Motivo por el que terminó la sesión, para el mensaje del login. */
export type SessionEndReason = 'inactivity' | 'expired' | 'blocked' | 'manual';

const ACTIVITY_EVENTS = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'] as const;

/**
 * Cierre automático por inactividad y renovación del token.
 *
 * El backend cierra la sesión cuando `lastActivityAt` supera el tiempo máximo
 * configurado. Aquí se replica ese reloj para avisar al usuario antes de que
 * ocurra, y se renueva el token mientras haya actividad real.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _secondsLeft = signal<number | null>(null);
  readonly secondsLeft = this._secondsLeft.asReadonly();

  /** Se muestra el aviso cuando falta menos del umbral configurado. */
  readonly warningVisible = computed(() => {
    const left = this._secondsLeft();
    return left !== null && left > 0 && left <= environment.sessionWarningMinutes * 60;
  });

  private lastActivityAt = Date.now();
  private lastRenewAt = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private listening = false;
  private readonly onActivity = () => this.registerActivity();

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  /** Arranca el reloj de sesión; idempotente. */
  start(): void {
    if (this.ticker) {
      return;
    }

    // La sesión se acaba de comprobar al entrar (login o recuperación al
    // recargar): renovarla otra vez aquí sería una segunda `auth/verify`
    // simultánea, y como cada una rota el token, la que llega tarde tumba la
    // sesión. El contador arranca como si ya se hubiera renovado.
    this.lastActivityAt = Date.now();
    this.lastRenewAt = Date.now();
    this.attachActivityListeners();

    // Fuera de Angular: un intervalo de un segundo no debe disparar detección
    // de cambios en cada tic.
    this.zone.runOutsideAngular(() => {
      this.ticker = setInterval(() => this.tick(), 1000);
    });
  }

  stop(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }

    this.detachActivityListeners();
    this._secondsLeft.set(null);
  }

  /** El usuario pidió continuar desde el aviso de inactividad. */
  continueSession(): void {
    this.registerActivity();
    this.renew(true);
  }

  /** Cierra la sesión y lleva al login explicando por qué. */
  endSession(reason: SessionEndReason): void {
    this.stop();
    this.auth.clear();

    void this.router.navigate(['/login'], {
      queryParams: reason === 'manual' ? {} : { reason },
      replaceUrl: true,
    });
  }

  private tick(): void {
    if (!this.auth.isAuthenticated()) {
      return;
    }

    const timeoutMs = this.auth.sessionTimeoutMinutes() * 60_000;
    const idleMs = Date.now() - this.lastActivityAt;
    const left = Math.max(0, Math.ceil((timeoutMs - idleMs) / 1000));

    this.zone.run(() => {
      this._secondsLeft.set(left);

      if (left === 0) {
        this.endSession('inactivity');
      }
    });
  }

  private registerActivity(): void {
    this.lastActivityAt = Date.now();
    this.renew(false);
  }

  /**
   * Renueva el token con `auth/verify`. Se espacia a la mitad de la ventana de
   * sesión para no llamar al backend en cada movimiento del ratón.
   */
  private renew(force: boolean): void {
    if (!this.auth.isAuthenticated()) {
      return;
    }

    const intervalMs = (this.auth.sessionTimeoutMinutes() * 60_000) / 2;

    if (!force && Date.now() - this.lastRenewAt < intervalMs) {
      return;
    }

    this.lastRenewAt = Date.now();

    this.zone.run(() => {
      this.auth.verify().subscribe({
        error: () => this.endSession('expired'),
      });
    });
  }

  private attachActivityListeners(): void {
    if (this.listening) {
      return;
    }

    this.listening = true;

    this.zone.runOutsideAngular(() => {
      ACTIVITY_EVENTS.forEach((event) =>
        this.document.addEventListener(event, this.onActivity, { passive: true }),
      );
    });
  }

  private detachActivityListeners(): void {
    if (!this.listening) {
      return;
    }

    this.listening = false;
    ACTIVITY_EVENTS.forEach((event) => this.document.removeEventListener(event, this.onActivity));
  }
}
