import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/auth/session.service';
import { ApiError } from '../../../core/models/api.models';
import { Alert, AlertVariant } from '../../../shared/alert/alert';
import { Icon } from '../../../shared/icon/icon';
import { applyServerErrors, controlError } from '../../../shared/form/form-errors';

/** Mensaje según el motivo por el que se volvió al login. */
const REASONS: Record<string, { variant: AlertVariant; message: string }> = {
  inactivity: {
    variant: 'warning',
    message: 'Su sesión se cerró por inactividad. Inicie sesión de nuevo.',
  },
  expired: {
    variant: 'warning',
    message: 'Su sesión expiró. Inicie sesión de nuevo.',
  },
  blocked: {
    variant: 'error',
    message: 'El acceso fue bloqueado. Contacte al administrador.',
  },
};

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, Alert, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly notice = signal(REASONS[this.route.snapshot.queryParamMap.get('reason') ?? '']);

  protected error(field: string): string | null {
    return controlError(this.form.get(field));
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }

    this.errorMessage.set(null);
    this.notice.set(undefined as never);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.submitting.set(true);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.submitting.set(false);

        if (response.user.mustChangePassword) {
          void this.router.navigate(['/cambiar-contrasena'], { replaceUrl: true });
          return;
        }

        this.session.start();
        void this.router.navigateByUrl(this.redirectTo(), { replaceUrl: true });
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        const unmatched = applyServerErrors(this.form, error.validation);
        this.errorMessage.set(unmatched[0] ?? error.message);
      },
    });
  }

  /** Devuelve al usuario a donde intentaba entrar antes del login. */
  private redirectTo(): string {
    const target = this.route.snapshot.queryParamMap.get('redirectTo');

    return target && target.startsWith('/') && !target.startsWith('//') ? target : '/inicio';
  }
}
