import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { SessionService } from '../../core/auth/session.service';
import { ROLE_LABELS } from '../../core/models/auth.models';
import { Icon } from '../../shared/icon/icon';
import { Modal, ModalFooter } from '../../shared/modal/modal';
import { NAV_GROUPS, NAV_ITEMS, NavGroup } from './navigation';

/**
 * Marco de la aplicación: barra lateral, encabezado, contenido y pie.
 * Incluye el aviso de cierre por inactividad.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Modal, ModalFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected readonly user = this.auth.user;
  protected readonly initials = this.auth.initials;
  protected readonly navItems = NAV_ITEMS;

  /** Ruta activa, para marcar el grupo al que pertenece la vista en curso. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly sidebarOpen = signal(true);
  protected readonly userMenuOpen = signal(false);
  protected readonly collapsedGroups = signal<Record<string, boolean>>({});

  protected readonly roleLabel = computed(() => {
    const role = this.user()?.roleName;
    return role ? ROLE_LABELS[role] : '';
  });

  /** Sólo los grupos que el rol actual puede ver. */
  protected readonly navGroups = computed<NavGroup[]>(() =>
    NAV_GROUPS.filter((group) => !group.roles || this.auth.hasRole(...group.roles)).map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || this.auth.hasRole(...item.roles)),
    })),
  );

  constructor() {
    // Al entrar a una subsección, su grupo se despliega solo. Si después el
    // usuario lo cierra a mano, se respeta hasta la siguiente navegación.
    effect(() => {
      const active = this.navGroups().find((group) => this.isGroupActive(group));

      if (active) {
        this.collapsedGroups.update((groups) => ({ ...groups, [active.label]: false }));
      }
    });
  }

  /** ¿Alguna subsección del grupo corresponde a la vista actual? */
  protected isGroupActive(group: NavGroup): boolean {
    const url = this.url();

    return group.items.some((item) => url === item.route || url.startsWith(`${item.route}/`));
  }

  protected readonly countdown = computed(() => {
    const seconds = this.session.secondsLeft() ?? 0;
    const minutes = Math.floor(seconds / 60);

    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  });

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  protected toggleGroup(label: string): void {
    this.collapsedGroups.update((groups) => ({ ...groups, [label]: !groups[label] }));
  }

  protected isCollapsed(label: string): boolean {
    return this.collapsedGroups()[label] === true;
  }

  protected continueSession(): void {
    this.session.continueSession();
  }

  protected logout(): void {
    this.closeUserMenu();

    this.auth.logout().subscribe({
      next: () => this.afterLogout(),
      // Aunque el backend falle, la sesión local se cierra igual.
      error: () => this.afterLogout(),
    });
  }

  private afterLogout(): void {
    this.session.stop();
    this.auth.clear();
    void this.router.navigate(['/login'], { replaceUrl: true });
  }
}
