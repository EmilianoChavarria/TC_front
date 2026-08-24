import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, Paginated } from '../../core/models/api.models';
import { ROLE_LABELS, RegisteredUser, RoleName } from '../../core/models/auth.models';
import { ManagedUser, UserStatus } from '../../core/models/user.models';
import { UsersService } from '../../core/users/users.service';
import { Alert } from '../../shared/alert/alert';
import { Icon } from '../../shared/icon/icon';
import { Modal, ModalFooter } from '../../shared/modal/modal';
import { applyServerErrors, controlError } from '../../shared/form/form-errors';

interface RoleOption {
  value: RoleName;
  label: string;
  description: string;
}

type Feedback = { variant: 'success' | 'error'; message: string } | null;

/** Confirmación pendiente: qué se le pregunta al usuario y qué se ejecuta si acepta. */
interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'primary' | 'danger';
  run: () => void;
}

/**
 * Gestión de Usuarios: listado con acciones y alta de cuentas.
 *
 * El alta habitual es de usuarios; sólo un superadministrador puede asignar el
 * rol de administrador, del que existe una única cuenta activa.
 */
@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, DatePipe, Alert, Icon, Modal, ModalFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.page.html',
})
export class UsersPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);

  // ------------------------------------------------------------------ listado

  protected readonly page = signal<Paginated<ManagedUser> | null>(null);
  protected readonly loading = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback>(null);
  protected readonly busyUuid = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly statusFilter = signal<UserStatus | 'all'>('active');
  protected readonly roleFilter = signal<RoleName | ''>('');

  protected readonly rows = computed(() => this.page()?.data ?? []);
  protected readonly total = computed(() => this.page()?.total ?? 0);
  protected readonly currentPage = computed(() => this.page()?.current_page ?? 1);
  protected readonly lastPage = computed(() => this.page()?.last_page ?? 1);

  // -------------------------------------------------------------------- altas

  protected readonly form = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    roleName: ['USER' as RoleName, [Validators.required]],
  });

  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly formOpen = signal(false);

  // ------------------------------------------------------------------ edición

  protected readonly confirming = signal<PendingConfirm | null>(null);
  protected readonly editing = signal<ManagedUser | null>(null);
  protected readonly editError = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly editForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    roleName: ['USER' as RoleName, [Validators.required]],
  });

  protected readonly canChooseRole = computed(() => this.auth.hasRole('SUPERADMIN'));
  protected readonly currentUuid = computed(() => this.auth.user()?.uuid ?? '');

  protected readonly roleOptions = computed<RoleOption[]>(() => {
    const options: RoleOption[] = [
      {
        value: 'USER',
        label: 'Usuario',
        description: 'Consulta el portal. Su cuenta se bloquea tras los intentos fallidos.',
      },
    ];

    if (this.canChooseRole()) {
      options.push({
        value: 'ADMIN',
        label: 'Administrador',
        description:
          'Administra usuarios y configuración. Sólo puede existir una cuenta activa con este rol.',
      });
    }

    return options;
  });

  constructor() {
    this.load();
  }

  protected roleLabel(role: RoleName): string {
    return ROLE_LABELS[role];
  }

  protected error(field: string): string | null {
    return controlError(this.form.get(field));
  }

  protected editFieldError(field: string): string | null {
    return controlError(this.editForm.get(field));
  }

  // ------------------------------------------------------------------ listado

  protected load(page = 1): void {
    this.loading.set(true);
    this.listError.set(null);

    this.users
      .list({
        search: this.search() || undefined,
        roleName: this.roleFilter(),
        status: this.statusFilter(),
        page,
      })
      .subscribe({
        next: (result) => {
          this.page.set(result);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.listError.set(error.message);
          this.loading.set(false);
        },
      });
  }

  protected applySearch(value: string): void {
    this.search.set(value.trim());
    this.load();
  }

  protected changeStatus(value: string): void {
    this.statusFilter.set(value as UserStatus | 'all');
    this.load();
  }

  protected changeRole(value: string): void {
    this.roleFilter.set(value as RoleName | '');
    this.load();
  }

  protected goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.load(page);
    }
  }

  // ------------------------------------------------------------------ acciones

  protected openForm(): void {
    this.createError.set(null);
    this.form.reset({ fullName: '', email: '', roleName: 'USER' });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected submit(): void {
    if (this.creating()) {
      return;
    }

    this.createError.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.creating.set(true);

    // Sin contraseña: el backend genera una temporal válida y la envía por correo.
    this.auth.register(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.creating.set(false);
        this.formOpen.set(false);
        this.feedback.set({
          variant: 'success',
          message: this.registeredMessage(user),
        });
        this.load(this.currentPage());
      },
      error: (error: ApiError) => {
        this.creating.set(false);
        const unmatched = applyServerErrors(this.form, error.validation);
        this.createError.set(unmatched[0] ?? error.message);
      },
    });
  }

  private registeredMessage(user: RegisteredUser): string {
    const base = `${user.fullName} (${user.email}) quedó registrado como ${this.roleLabel(user.roleName)}.`;

    return user.passwordGenerated
      ? `${base} Se le envió la contraseña temporal por correo.`
      : base;
  }

  protected edit(user: ManagedUser): void {
    this.editError.set(null);
    this.editing.set(user);
    this.editForm.reset({
      fullName: user.fullName,
      email: user.email,
      roleName: user.roleName,
    });
  }

  protected closeEdit(): void {
    this.editing.set(null);
  }

  protected saveEdit(): void {
    const user = this.editing();

    if (!user || this.saving()) {
      return;
    }

    this.editError.set(null);
    this.editForm.markAllAsTouched();

    if (this.editForm.invalid) {
      return;
    }

    this.saving.set(true);
    const value = this.editForm.getRawValue();

    // Sólo se envía el rol cuando cambió: el backend rechaza cambiar el propio.
    const payload = {
      fullName: value.fullName,
      email: value.email,
      ...(value.roleName !== user.roleName ? { roleName: value.roleName } : {}),
    };

    this.users.update(user.uuid, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.feedback.set({ variant: 'success', message: 'Usuario actualizado.' });
        this.load(this.currentPage());
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        const unmatched = applyServerErrors(this.editForm, error.validation);
        this.editError.set(unmatched[0] ?? error.message);
      },
    });
  }

  protected deactivate(user: ManagedUser): void {
    this.confirming.set({
      title: 'Dar de baja la cuenta',
      message: `${user.fullName} dejará de poder entrar y su sesión se cerrará de inmediato. Podrá reactivarla después.`,
      confirmLabel: 'Dar de baja',
      variant: 'danger',
      run: () =>
        this.run(user, this.users.deactivate(user.uuid), `${user.fullName} quedó dado de baja.`),
    });
  }

  protected acceptConfirm(): void {
    const pending = this.confirming();
    this.confirming.set(null);
    pending?.run();
  }

  protected cancelConfirm(): void {
    this.confirming.set(null);
  }

  protected restore(user: ManagedUser): void {
    this.run(user, this.users.restore(user.uuid), `${user.fullName} fue reactivado.`);
  }

  protected resetPassword(user: ManagedUser): void {
    this.confirming.set({
      title: 'Restablecer contraseña',
      message: `Se generará una contraseña temporal para ${user.fullName} y se enviará a ${user.email}. Su sesión actual se cerrará.`,
      confirmLabel: 'Restablecer',
      variant: 'primary',
      run: () =>
        this.run(
          user,
          this.users.resetPassword(user.uuid),
          `Se envió una contraseña temporal a ${user.email}.`,
        ),
    });
  }

  private run(
    user: ManagedUser,
    request: ReturnType<UsersService['restore']>,
    successMessage: string,
  ): void {
    this.busyUuid.set(user.uuid);
    this.feedback.set(null);

    request.subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.feedback.set({ variant: 'success', message: successMessage });
        this.load(this.currentPage());
      },
      error: (error: ApiError) => {
        this.busyUuid.set(null);
        const detail = error.validation ? Object.values(error.validation)[0]?.[0] : null;
        this.feedback.set({ variant: 'error', message: detail ?? error.message });
      },
    });
  }
}
