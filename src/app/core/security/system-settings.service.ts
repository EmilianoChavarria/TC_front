import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../http/api.client';
import {
  LoginAttemptSettings,
  PasswordRequirementsSettings,
  UpdateLoginAttemptSettingsRequest,
  UpdatePasswordRequirementsRequest,
} from '../models/security.models';

/**
 * Configuración del Sistema: requisitos de contraseña, inactividad de sesión y
 * umbrales de bloqueo.
 *
 * Son dos recursos distintos del backend porque los consume gente distinta —el
 * formulario de contraseña sólo necesita el primero— pero se administran en la
 * misma pantalla, así que el servicio los agrupa.
 */
@Injectable({ providedIn: 'root' })
export class SystemSettingsService {
  private readonly api = inject(ApiClient);

  passwordRequirements(): Observable<PasswordRequirementsSettings> {
    return this.api.get<PasswordRequirementsSettings>('password-requirements');
  }

  updatePasswordRequirements(
    payload: UpdatePasswordRequirementsRequest,
  ): Observable<PasswordRequirementsSettings> {
    return this.api.put<PasswordRequirementsSettings>('password-requirements', payload);
  }

  loginAttemptSettings(): Observable<LoginAttemptSettings> {
    return this.api.get<LoginAttemptSettings>('security/login-attempt-settings');
  }

  updateLoginAttemptSettings(
    payload: UpdateLoginAttemptSettingsRequest,
  ): Observable<LoginAttemptSettings> {
    return this.api.put<LoginAttemptSettings>('security/login-attempt-settings', payload);
  }
}
