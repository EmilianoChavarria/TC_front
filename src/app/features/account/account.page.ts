import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/models/api.models';
import { PasswordRequirements, ROLE_LABELS } from '../../core/models/auth.models';
import { Alert } from '../../shared/alert/alert';
import { Icon } from '../../shared/icon/icon';
import { applyServerErrors, controlError } from '../../shared/form/form-errors';
import { allRulesMet, passwordRules } from '../../shared/form/password.rules';

/** Datos de la cuenta y cambio voluntario de contraseña. */
@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule, DatePipe, Alert, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.page.html',
})
export class AccountPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.user;
  protected readonly sessionTimeout = this.auth.sessionTimeoutMinutes;

  protected readonly form = this.formBuilder.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required]],
    newPassword_confirmation: ['', [Validators.required]],
  });

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  /** Cada campo alterna entre texto y puntos por su cuenta. */
  private readonly visible = signal<Record<string, boolean>>({});

  protected isVisible(field: string): boolean {
    return this.visible()[field] === true;
  }

  protected toggleVisibility(field: string): void {
    this.visible.update((state) => ({ ...state, [field]: !state[field] }));
  }

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

  protected readonly roleLabel = computed(() => {
    const role = this.user()?.roleName;
    return role ? ROLE_LABELS[role] : '';
  });

  protected error(field: string): string | null {
    return controlError(this.form.get(field));
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid || this.mismatch() || !this.rulesMet()) {
      return;
    }

    this.submitting.set(true);

    this.auth.changePassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.successMessage.set('Su contraseña se actualizó correctamente.');
        this.form.reset();
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        const unmatched = applyServerErrors(this.form, error.validation);
        this.errorMessage.set(unmatched[0] ?? error.message);
      },
    });
  }
}
