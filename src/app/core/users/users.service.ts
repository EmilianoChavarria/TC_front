import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../http/api.client';
import { Paginated } from '../models/api.models';
import {
  ManagedUser,
  RoleOption,
  UpdateUserRequest,
  UserFilters,
} from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiClient);

  list(filters: UserFilters): Observable<Paginated<ManagedUser>> {
    return this.api.get<Paginated<ManagedUser>>('users', {
      search: filters.search ?? null,
      roleName: filters.roleName || null,
      status: filters.status ?? 'active',
      page: filters.page ?? 1,
      perPage: filters.perPage ?? 15,
    });
  }

  roles(): Observable<RoleOption[]> {
    return this.api.get<RoleOption[]>('users/roles');
  }

  update(uuid: string, payload: UpdateUserRequest): Observable<ManagedUser> {
    return this.api.put<ManagedUser>(`users/${uuid}`, payload);
  }

  /** Baja lógica: la cuenta deja de poder entrar y su sesión se corta. */
  deactivate(uuid: string): Observable<ManagedUser> {
    return this.api.delete<ManagedUser>(`users/${uuid}`);
  }

  restore(uuid: string): Observable<ManagedUser> {
    return this.api.post<ManagedUser>(`users/${uuid}/restore`);
  }

  /** Genera una contraseña temporal nueva y la envía por correo. */
  resetPassword(uuid: string): Observable<ManagedUser> {
    return this.api.post<ManagedUser>(`users/${uuid}/reset-password`);
  }
}
