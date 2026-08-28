import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../core/models/api.models';
import {
  LoginAttemptSettings,
  PasswordRequirementsSettings,
  SettingsAuthor,
} from '../../core/models/security.models';
import { SystemSettingsService } from '../../core/security/system-settings.service';
import { Alert } from '../../shared/alert/alert';
import { applyServerErrors, controlError } from '../../shared/form/form-errors';

type Feedback = { variant: 'success' | 'error'; message: string } | null;

/** Firma del último cambio aplicado, para el pie de la pantalla. */
interface LastChange {
  author: string | null;
  at: string | null;
}

/**
 * Configuración del Sistema.
 *
 * Reúne dos recursos del backend —requisitos de contraseña y umbrales de
 * autenticación— porque para quien administra es una sola decisión: qué tan
 * estricto es entrar al portal. Se guardan juntos con un único botón.
 *
 * ⚠️ Los requisitos de contraseña NO se revalidan sobre las contraseñas ya
 * existentes: aplican a altas, cambios y restauraciones. Subir la longitud
 * mínima no bloquea a nadie hoy; se le exige al siguiente cambio.
 */
@Component({
  selector: 'app-system-settings-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, Alert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './system-settings.page.html',
})
export class SystemSettingsPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly settings = inject(SystemSettingsService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback>(null);
  protected readonly submitted = signal(false);

  /** Ventana sobre la que el backend cuenta los fallos; no es editable aquí. */
  protected readonly attemptWindowHours = signal(24);

  protected readonly lastChange = signal<LastChange>({ author: null, at: null });

  protected readonly passwordForm = this.formBuilder.nonNullable.group({
    minLength: [10, [Validators.required, Validators.min(6), Validators.max(128)]],
    expirationDays: [90, [Validators.required, Validators.min(0), Validators.max(3650)]],
    requireUppercase: [true],
    requireLowercase: [true],
    requireNumbers: [true],
    requireSpecialChars: [true],
    allowedSpecialChars: ['!#$%&*?', [Validators.maxLength(255)]],
  });

  protected readonly authForm = this.formBuilder.nonNullable.group({
    sessionTimeoutMinutes: [15, [Validators.required, Validators.min(1), Validators.max(10080)]],
    maxUserAttempts: [5, [Validators.required, Validators.min(1), Validators.max(1000)]],
    maxIpAttempts: [12, [Validators.required, Validators.min(1), Validators.max(1000)]],
  });

  /** Se refleja en vivo para mostrar u ocultar el campo de caracteres permitidos. */
  protected readonly specialCharsEnabled = signal(true);

  private readonly expirationDays = signal(90);

  /**
   * 0 días significa «la contraseña no caduca». Se dice explícitamente porque
   * un 0 en un campo llamado «vigencia» se lee igual de bien como «caduca hoy».
   */
  protected readonly expirationHint = computed(() =>
    this.expirationDays() === 0
      ? 'Con 0 la contraseña no caduca.'
      : 'Al cumplirse los días, se le pide al usuario cambiarla antes de continuar.',
  );

  constructor() {
    this.load();
  }

  protected error(control: string, form: 'password' | 'auth' = 'password'): string | null {
    const group: FormGroup = form === 'password' ? this.passwordForm : this.authForm;

    return controlError(group.get(control), this.submitted());
  }

  protected onExpirationChange(value: string): void {
    this.expirationDays.set(Number(value));
  }

  protected toggleSpecialChars(checked: boolean): void {
    this.specialCharsEnabled.set(checked);
    this.passwordForm.patchValue({ requireSpecialChars: checked });
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      password: this.settings.passwordRequirements(),
      auth: this.settings.loginAttemptSettings(),
    }).subscribe({
      next: ({ password, auth }) => {
        this.applyPassword(password);
        this.applyAuth(auth);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  /**
   * Guarda las dos configuraciones.
   *
   * Son dos peticiones porque son dos recursos, pero se lanzan juntas y el
   * resultado se reporta una sola vez: para quien administra fue un solo
   * «Guardar configuración», y un éxito a medias no le sirve de nada.
   */
  protected save(): void {
    this.submitted.set(true);
    this.formError.set(null);
    this.feedback.set(null);

    this.passwordForm.markAllAsTouched();
    this.authForm.markAllAsTouched();

    if (this.passwordForm.invalid || this.authForm.invalid) {
      this.formError.set('Revise los campos marcados.');
      return;
    }

    const password = this.passwordForm.getRawValue();
    const auth = this.authForm.getRawValue();
    const allowed = password.allowedSpecialChars.trim();

    this.saving.set(true);

    forkJoin({
      password: this.settings.updatePasswordRequirements({
        ...password,
        // Vacío deja que el servidor use su lista por omisión: exigir un
        // carácter especial sin decir cuáles se admiten no se puede cumplir.
        allowedSpecialChars: password.requireSpecialChars ? allowed || null : null,
      }),
      auth: this.settings.updateLoginAttemptSettings(auth),
    }).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.submitted.set(false);
        this.applyPassword(result.password);
        this.applyAuth(result.auth);
        this.feedback.set({ variant: 'success', message: 'Configuración guardada.' });
      },
      error: (error: ApiError) => {
        this.saving.set(false);

        const unmatched = [
          ...applyServerErrors(this.passwordForm, error.validation),
          ...applyServerErrors(this.authForm, error.validation),
        ];

        this.formError.set(unmatched[0] ?? error.message);
        this.feedback.set({ variant: 'error', message: 'No se guardó la configuración.' });
      },
    });
  }

  private applyPassword(requirements: PasswordRequirementsSettings): void {
    this.passwordForm.reset({
      minLength: requirements.minLength,
      expirationDays: requirements.expirationDays,
      requireUppercase: requirements.requireUppercase,
      requireLowercase: requirements.requireLowercase,
      requireNumbers: requirements.requireNumbers,
      requireSpecialChars: requirements.requireSpecialChars,
      allowedSpecialChars: requirements.allowedSpecialChars ?? '',
    });

    this.specialCharsEnabled.set(requirements.requireSpecialChars);
    this.expirationDays.set(requirements.expirationDays);
    this.trackChange(requirements.updatedBy, requirements.updatedAt);
  }

  private applyAuth(settings: LoginAttemptSettings): void {
    this.authForm.reset({
      sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
      maxUserAttempts: settings.maxUserAttempts,
      maxIpAttempts: settings.maxIpAttempts,
    });

    this.attemptWindowHours.set(settings.attemptWindowHours);
    this.trackChange(settings.updatedBy, settings.updatedAt);
  }

  /** Se queda con la más reciente de las dos configuraciones. */
  private trackChange(author: SettingsAuthor | undefined, at: string | null): void {
    if (!at) {
      return;
    }

    const current = this.lastChange();

    if (current.at && current.at >= at) {
      return;
    }

    this.lastChange.set({ author: author?.fullName ?? null, at });
  }
}
