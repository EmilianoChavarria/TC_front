import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';

import { ApiError } from '../../core/models/api.models';
import {
  BlockedIp,
  BlockedIpsPage,
  BlockedUser,
  BlockedUsersPage,
  SecuritySummary,
} from '../../core/models/security.models';
import { SecurityAccessService } from '../../core/security/security-access.service';
import { Alert } from '../../shared/alert/alert';
import { Icon } from '../../shared/icon/icon';
import { Modal } from '../../shared/modal/modal';

type Feedback = { variant: 'success' | 'error'; message: string } | null;

/** Confirmación pendiente: qué se pregunta y qué se ejecuta si acepta. */
interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => void;
}

const PER_PAGE = 10;

/**
 * Gestión de Seguridad: historial de bloqueos y desbloqueo manual.
 *
 * Las dos tablas son historial completo, no sólo lo bloqueado hoy: cuando
 * alguien pregunta «¿por qué no pude entrar ayer?», la fila ya liberada es la
 * respuesta, y ocultarla obliga a buscarla en la bitácora.
 *
 * Los bloqueos los produce el backend al superarse los umbrales de
 * Configuración del Sistema; aquí sólo se liberan.
 */
@Component({
  selector: 'app-security-page',
  imports: [DatePipe, Alert, Icon, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './security.page.html',
})
export class SecurityPage {
  private readonly security = inject(SecurityAccessService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback>(null);

  /** Identificador de la fila en curso: uuid del usuario o dirección IP. */
  protected readonly busyKey = signal<string | null>(null);

  protected readonly summary = signal<SecuritySummary | null>(null);

  protected readonly users = signal<BlockedUser[]>([]);
  protected readonly userPage = signal(1);
  protected readonly userLastPage = signal(1);
  protected readonly userTotal = signal(0);

  protected readonly ips = signal<BlockedIp[]>([]);
  protected readonly ipPage = signal(1);
  protected readonly ipLastPage = signal(1);
  protected readonly ipTotal = signal(0);

  /** Deja fuera del historial lo que ya se liberó. */
  protected readonly onlyActive = signal(false);

  protected readonly confirming = signal<PendingConfirm | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      summary: this.security.summary(),
      users: this.security.blockedUsers({
        onlyActive: this.onlyActive(),
        page: this.userPage(),
        perPage: PER_PAGE,
      }),
      ips: this.security.blockedIps({
        onlyActive: this.onlyActive(),
        page: this.ipPage(),
        perPage: PER_PAGE,
      }),
    }).subscribe({
      next: ({ summary, users, ips }) => {
        this.summary.set(summary);
        this.applyUsers(users);
        this.applyIps(ips);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  protected toggleOnlyActive(): void {
    this.onlyActive.update((value) => !value);
    // Cambia el total de las dos tablas: quedarse en la página 4 de una lista
    // que ahora tiene una sola dejaría ambas vacías.
    this.userPage.set(1);
    this.ipPage.set(1);
    this.load();
  }

  protected goToUserPage(page: number): void {
    if (page < 1 || page > this.userLastPage() || page === this.userPage()) {
      return;
    }

    this.userPage.set(page);
    this.loadUsers();
  }

  protected goToIpPage(page: number): void {
    if (page < 1 || page > this.ipLastPage() || page === this.ipPage()) {
      return;
    }

    this.ipPage.set(page);
    this.loadIps();
  }

  protected confirmUnlockUser(row: BlockedUser): void {
    const who = row.fullName ?? row.email ?? 'el usuario';

    this.confirming.set({
      title: 'Desbloquear usuario',
      message: `${who} podrá volver a iniciar sesión y su contador de fallos se pone en cero.`,
      confirmLabel: 'Desbloquear',
      run: () => this.runUnlock(row.userUuid ?? row.uuid, this.unlockUserRequest(row), `${who} desbloqueado.`),
    });
  }

  protected confirmUnlockIp(row: BlockedIp): void {
    this.confirming.set({
      title: 'Desbloquear dirección IP',
      message: `Se permitirán de nuevo los intentos de inicio de sesión desde ${row.ipAddress}.`,
      confirmLabel: 'Desbloquear',
      run: () =>
        this.runUnlock(
          row.ipAddress,
          this.security.unlockIp(row.ipAddress),
          `${row.ipAddress} desbloqueada.`,
        ),
    });
  }

  protected acceptConfirm(): void {
    const pending = this.confirming();
    this.confirming.set(null);
    pending?.run();
  }

  protected dismissConfirm(): void {
    this.confirming.set(null);
  }

  /**
   * El desbloqueo se hace contra el usuario, no contra la fila del historial:
   * un mismo usuario puede tener varios bloqueos registrados y lo que se
   * libera es la cuenta.
   */
  private unlockUserRequest(row: BlockedUser): Observable<null> {
    return this.security.unlockUser(row.userUuid ?? '');
  }

  private runUnlock(key: string, request: Observable<null>, message: string): void {
    this.busyKey.set(key);

    request.subscribe({
      next: () => {
        this.busyKey.set(null);
        this.feedback.set({ variant: 'success', message });
        this.load();
      },
      error: (error: ApiError) => {
        this.busyKey.set(null);
        this.feedback.set({ variant: 'error', message: error.message });
      },
    });
  }

  private loadUsers(): void {
    this.security
      .blockedUsers({ onlyActive: this.onlyActive(), page: this.userPage(), perPage: PER_PAGE })
      .subscribe({
        next: (page) => this.applyUsers(page),
        error: (error: ApiError) => this.feedback.set({ variant: 'error', message: error.message }),
      });
  }

  private loadIps(): void {
    this.security
      .blockedIps({ onlyActive: this.onlyActive(), page: this.ipPage(), perPage: PER_PAGE })
      .subscribe({
        next: (page) => this.applyIps(page),
        error: (error: ApiError) => this.feedback.set({ variant: 'error', message: error.message }),
      });
  }

  /**
   * Si al liberar el último registro la página quedó vacía, se retrocede en
   * vez de mostrar una tabla vacía con el paginador diciendo que hay filas.
   */
  private applyUsers(page: BlockedUsersPage): void {
    this.users.set(page.data);
    this.userLastPage.set(page.last_page);
    this.userTotal.set(page.total);

    if (page.data.length === 0 && page.current_page > 1) {
      this.userPage.set(page.last_page);
      this.loadUsers();

      return;
    }

    this.userPage.set(page.current_page);
  }

  private applyIps(page: BlockedIpsPage): void {
    this.ips.set(page.data);
    this.ipLastPage.set(page.last_page);
    this.ipTotal.set(page.total);

    if (page.data.length === 0 && page.current_page > 1) {
      this.ipPage.set(page.last_page);
      this.loadIps();

      return;
    }

    this.ipPage.set(page.current_page);
  }
}
