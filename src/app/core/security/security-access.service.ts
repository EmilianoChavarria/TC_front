import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../http/api.client';
import {
  BlockFilters,
  BlockedIpsPage,
  BlockedUsersPage,
  SecuritySummary,
} from '../models/security.models';

/**
 * Gestión de Seguridad: historial de bloqueos y desbloqueo manual.
 *
 * Los listados son historial completo; `onlyActive` deja sólo lo que sigue
 * bloqueado. Se pagina en el servidor porque el historial crece sin tope.
 */
@Injectable({ providedIn: 'root' })
export class SecurityAccessService {
  private readonly api = inject(ApiClient);

  summary(): Observable<SecuritySummary> {
    return this.api.get<SecuritySummary>('security/summary');
  }

  blockedUsers(filters: BlockFilters = {}): Observable<BlockedUsersPage> {
    return this.api.get<BlockedUsersPage>('security/users/blocked', {
      onlyActive: filters.onlyActive ? 1 : 0,
      page: filters.page ?? 1,
      perPage: filters.perPage ?? 10,
    });
  }

  blockedIps(filters: BlockFilters = {}): Observable<BlockedIpsPage> {
    return this.api.get<BlockedIpsPage>('security/ips/blocked', {
      onlyActive: filters.onlyActive ? 1 : 0,
      page: filters.page ?? 1,
      perPage: filters.perPage ?? 10,
    });
  }

  /** Deja al usuario entrar de nuevo y pone su contador de fallos en cero. */
  unlockUser(userUuid: string): Observable<null> {
    return this.api.post<null>(`security/users/${userUuid}/unlock`);
  }

  /** La IP es el identificador del recurso; no hay id interno que usar. */
  unlockIp(ipAddress: string): Observable<null> {
    return this.api.post<null>('security/ips/unlock', { ipAddress });
  }
}
