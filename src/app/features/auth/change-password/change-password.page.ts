import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/auth/session.service';
import { ApiError } from '../../../core/models/api.models';
import { PasswordRequirements } from '../../../core/models/auth.models';
import { Alert } from '../../../shared/alert/alert';
import { Icon } from '../../../shared/icon/icon';
import { applyServerErrors, controlError } from '../../../shared/form/form-errors';
import { allRulesMet, passwordRules } from '../../../shared/form/password.rules';

/**
 * Cambio de contraseña. Es la única pantalla accesible mientras el backend
 * marque `mustChangePassword`, ya sea por ser el primer acceso o porque la
 * contraseña caducó.
 */
@Component({
  selector: 'app-change-password-page',
  imports: [ReactiveFormsModule, Alert, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './change-password.page.html',
})
export class ChangePasswordPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;

  protected readonly form = this.formBuilder.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required]],
    newPassword_confirmation: ['', [Validators.required]],
  });

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Cada campo alterna entre texto y puntos por su cuenta. */
  private readonly visible = signal<Record<string, boolean>>({});

  protected isVisible(field: string): boolean {
    return this.visible()[field] === true;
  }

  protected toggleVisibility(field: string): void {
    this.visible.update((state) => ({ ...state, [field]: !state[field] }));
  }

  /** Los requisitos los define el administrador: se leen del backend. */
  protected readonly requirements = toSignal(
    this.auth.passwordRequirements().pipe(catchError(() => of(null))),
    { initialValue: null as PasswordRequirements | null },
  );

  private readonly newPassword = toSignal(this.form.controls.newPassword.valueChanges, {
    initialValue: '',
  });

  private readonly confirmation = toSignal(
    this.form.controls.newPassword_confirmation.valueChanges,
    { initialValue: '' },
  );

  protected readonly rules = computed(() => passwordRules(this.newPassword(), this.requirements()));
  protected readonly rulesMet = computed(() => allRulesMet(this.rules()));

  protected readonly mismatch = computed(
    () => this.confirmation().length > 0 && this.confirmation() !== this.newPassword(),
  );

  protected readonly expired = computed(() => this.user()?.passwordExpired === true);

  protected error(field: string): string | null {
    return controlError(this.form.get(field));
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }

    this.errorMessage.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid || this.mismatch() || !this.rulesMet()) {
      return;
    }

    this.submitting.set(true);

    this.auth.changePassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.session.start();
        void this.router.navigate(['/inicio'], { replaceUrl: true });
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        const unmatched = applyServerErrors(this.form, error.validation);
        this.errorMessage.set(unmatched[0] ?? error.message);
      },
    });
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => this.session.endSession('manual'),
      error: () => this.session.endSession('manual'),
    });
  }
}
