import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiClient } from '../http/api.client';
import {
  ADMIN_ROLES,
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  PasswordRequirements,
  RegisterUserRequest,
  RegisteredUser,
  RoleName,
  VerifyResponse,
} from '../models/auth.models';

export type AuthStatus = 'unknown' | 'authenticated' | 'guest';

/**
 * Estado de autenticación de la aplicación.
 *
 * El JWT vive en una cookie httpOnly que este código no puede leer: la fuente
 * de verdad de la sesión es el backend. Al arrancar se pregunta con
 * `auth/verify`, que además renueva el token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _status = signal<AuthStatus>('unknown');
  private readonly _sessionTimeoutMinutes = signal<number>(15);

  readonly user = this._user.asReadonly();
  readonly status = this._status.asReadonly();
  readonly sessionTimeoutMinutes = this._sessionTimeoutMinutes.asReadonly();

  readonly isAuthenticated = computed(() => this._status() === 'authenticated');
  readonly mustChangePassword = computed(() => this._user()?.mustChangePassword === true);
  readonly isAdmin = computed(() => {
    const role = this._user()?.roleName;
    return role !== undefined && ADMIN_ROLES.includes(role);
  });

  readonly initials = computed(() => {
    const name = this._user()?.fullName?.trim() ?? '';
    if (!name) {
      return '';
    }

    const [first = '', second = ''] = name.split(/\s+/);
    return (first.charAt(0) + second.charAt(0)).toUpperCase();
  });

  hasRole(...roles: RoleName[]): boolean {
    const role = this._user()?.roleName;
    return role !== undefined && roles.includes(role);
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.api
      .post<LoginResponse>('auth/login', credentials)
      .pipe(tap((response) => this.apply(response.user, response.sessionTimeoutMinutes)));
  }

  /** Revalida la sesión y renueva el token. Es también el latido de sesión. */
  verify(): Observable<VerifyResponse> {
    return this.api
      .get<VerifyResponse>('auth/verify')
      .pipe(tap((response) => this.apply(response.user, response.sessionTimeoutMinutes)));
  }

  logout(): Observable<unknown> {
    return this.api.post<unknown>('auth/logout').pipe(tap(() => this.clear()));
  }

  changePassword(payload: ChangePasswordRequest): Observable<unknown> {
    return this.api.post<unknown>('auth/change-password', payload).pipe(
      tap(() => {
        const user = this._user();
        if (user) {
          this._user.set({ ...user, mustChangePassword: false, passwordExpired: false });
        }
      }),
    );
  }

  register(payload: RegisterUserRequest): Observable<RegisteredUser> {
    return this.api.post<RegisteredUser>('auth/register', payload);
  }

  passwordRequirements(): Observable<PasswordRequirements> {
    return this.api.get<PasswordRequirements>('password-requirements');
  }

  /** Marca la sesión como cerrada sin llamar al backend (401, expiración). */
  clear(): void {
    this._user.set(null);
    this._status.set('guest');
  }

  private apply(user: AuthUser, sessionTimeoutMinutes: number): void {
    this._user.set(user);
    this._status.set('authenticated');
    this._sessionTimeoutMinutes.set(Math.max(1, sessionTimeoutMinutes));
  }
}
