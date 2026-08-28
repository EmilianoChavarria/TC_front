import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../core/models/api.models';
import { EmailMode } from '../../core/models/email-config.models';
import {
  NotificationRecipient,
  NotificationRecipientsPage,
} from '../../core/models/notification.models';
import { EmailConfigService } from '../../core/notifications/email-config.service';
import { NotificationRecipientsService } from '../../core/notifications/notification-recipients.service';
import { Alert } from '../../shared/alert/alert';
import { Icon } from '../../shared/icon/icon';
import { Modal } from '../../shared/modal/modal';

type Feedback = { variant: 'success' | 'error'; message: string } | null;

/** Tamaños de página ofrecidos; el primero es el que se usa al entrar. */
const PER_PAGE_OPTIONS = [10, 20, 50];

/** Opciones del modo de envío, con lo que implica cada una. */
const EMAIL_MODES: { value: EmailMode; label: string; description: string }[] = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Cada correo llega a su destinatario real.',
  },
  {
    value: 'override',
    label: 'Redirigir a un solo correo',
    description:
      'Todo se manda a la dirección indicada, con el aviso de a quién le hubiera llegado. Para pruebas, sin escribirle a nadie de la lista.',
  },
  {
    value: 'disabled',
    label: 'No enviar nada',
    description: 'No sale ningún correo.',
  },
];

/** Confirmación pendiente: qué se pregunta y qué se ejecuta si acepta. */
interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'primary' | 'danger';
  run: () => void;
}

/**
 * Correos que reciben el aviso del tipo de cambio.
 *
 * ⚠️ No son usuarios del portal. Son buzones de terceros —contabilidad, un
 * corporativo, una lista de distribución— que necesitan el dato del día sin
 * tener cuenta ni entrar a nada. Por eso esta pantalla no comparte nada con
 * Gestión de Usuarios: dar de alta aquí no crea un acceso.
 */
@Component({
  selector: 'app-notification-recipients-page',
  imports: [ReactiveFormsModule, DatePipe, Alert, Icon, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recipients.page.html',
})
export class RecipientsPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly recipients = inject(NotificationRecipientsService);
  private readonly emailConfig = inject(EmailConfigService);

  protected readonly rows = signal<NotificationRecipient[]>([]);
  protected readonly loading = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback>(null);
  protected readonly busyUuid = signal<string | null>(null);
  protected readonly includeDeleted = signal(false);

  /**
   * Cuántos van a recibir el próximo aviso.
   *
   * Se muestra arriba porque es la única cifra que importa de esta pantalla:
   * una lista larga con todos pausados no manda nada, y sin este contador eso
   * solo se descubre cuando alguien reclama que no le llegó el correo.
   *
   * ⚠️ Viene del backend y NO se calcula sobre `rows()`: con la lista paginada,
   * contar lo que está en pantalla daría una cifra distinta en cada página.
   */
  protected readonly notifiableCount = signal(0);

  // ------------------------------------------------------------- paginación

  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected readonly perPage = signal(PER_PAGE_OPTIONS[0]);
  protected readonly perPageOptions = PER_PAGE_OPTIONS;

  protected readonly form = this.formBuilder.nonNullable.group({
    emails: ['', [Validators.required]],
  });

  /**
   * Lo que se escribió, ya separado.
   *
   * Es una señal y no un cálculo al enviar para poder decir «se detectaron 8
   * correos» mientras se escribe: pegar una lista larga y no saber si el
   * separador se entendió es donde esto falla en la práctica.
   */
  protected readonly typed = signal('');

  protected readonly detected = computed(() => this.split(this.typed()));

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly submitted = signal(false);

  /** uuid en edición; null cuando el formulario es de alta. */
  protected readonly editingUuid = signal<string | null>(null);

  protected readonly confirming = signal<PendingConfirm | null>(null);

  // ------------------------------------------------------------ modo de envío

  protected readonly modes = EMAIL_MODES;

  protected readonly modeForm = this.formBuilder.nonNullable.group({
    emailMode: ['normal' as EmailMode, [Validators.required]],
    overrideEmail: ['', [Validators.email]],
    emailSupport: ['', [Validators.required, Validators.email]],
  });

  protected readonly modeLoading = signal(false);
  protected readonly modeSaving = signal(false);
  protected readonly modeError = signal<string | null>(null);
  protected readonly currentMode = signal<EmailMode>('normal');
  protected readonly currentOverride = signal<string | null>(null);

  /** Selección en curso; el campo de redirección sólo aplica en override. */
  protected readonly selectedMode = signal<EmailMode>('normal');

  /**
   * Lo que pasará con la lista de abajo si se guarda así.
   *
   * Se dice aquí porque el contador de destinatarios sigue diciendo «N
   * recibirán el aviso», y en override o deshabilitado eso deja de ser cierto.
   */
  protected readonly modeWarning = computed(() => {
    const mode = this.selectedMode();

    if (mode === 'disabled') {
      return 'Con esta opción no se enviará ningún aviso, ni el del proceso diario ni el de una corrección manual.';
    }

    if (mode === 'override') {
      return 'Los destinatarios de la lista no recibirán nada: todo se redirige al correo indicado.';
    }

    return null;
  });

  constructor() {
    this.load();
    this.loadMode();
  }

  protected loadMode(): void {
    this.modeLoading.set(true);
    this.modeError.set(null);

    this.emailConfig.show().subscribe({
      next: (config) => {
        this.modeForm.reset({
          emailMode: config.emailMode,
          overrideEmail: config.overrideEmail ?? '',
          emailSupport: config.emailSupport ?? '',
        });
        this.selectedMode.set(config.emailMode);
        this.currentMode.set(config.emailMode);
        this.currentOverride.set(config.overrideEmail);
        this.modeLoading.set(false);
      },
      error: (error: ApiError) => {
        this.modeError.set(error.message);
        this.modeLoading.set(false);
      },
    });
  }

  protected chooseMode(mode: EmailMode): void {
    this.selectedMode.set(mode);
    this.modeForm.patchValue({ emailMode: mode });
  }

  protected saveMode(): void {
    this.modeError.set(null);

    const { emailMode, overrideEmail, emailSupport } = this.modeForm.getRawValue();
    const override = overrideEmail.trim();

    // Misma regla que el backend: sin dirección, redirigir no manda nada.
    if (emailMode === 'override' && override === '') {
      this.modeError.set('Indique el correo al que se redirigen los envíos.');
      return;
    }

    if (this.modeForm.controls.emailSupport.invalid) {
      this.modeError.set('Indique un correo de soporte válido.');
      return;
    }

    this.modeSaving.set(true);

    this.emailConfig
      .update({
        emailMode,
        emailSupport: emailSupport.trim(),
        overrideEmail: emailMode === 'override' ? override : null,
      })
      .subscribe({
        next: (config) => {
          this.modeSaving.set(false);
          this.currentMode.set(config.emailMode);
          this.currentOverride.set(config.overrideEmail);
          this.selectedMode.set(config.emailMode);
          this.feedback.set({
            variant: 'success',
            message: this.modeSavedMessage(config.emailMode, config.overrideEmail),
          });
        },
        error: (error: ApiError) => {
          this.modeSaving.set(false);

          const first = error.validation ? Object.values(error.validation)[0]?.[0] : null;

          this.modeError.set(first ?? error.message);
        },
      });
  }

  private modeSavedMessage(mode: EmailMode, override: string | null): string {
    if (mode === 'disabled') {
      return 'Modo de envío guardado: no se enviará ningún correo.';
    }

    if (mode === 'override') {
      return `Modo de envío guardado: todo se redirige a ${override ?? ''}.`;
    }

    return 'Modo de envío guardado: los correos llegan a sus destinatarios reales.';
  }

  protected load(): void {
    this.loading.set(true);
    this.listError.set(null);

    this.recipients
      .list({
        includeDeleted: this.includeDeleted(),
        page: this.page(),
        perPage: this.perPage(),
      })
      .subscribe({
        next: (page) => {
          this.applyPage(page);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.listError.set(error.message);
          this.loading.set(false);
        },
      });
  }

  /** Cambiar el tamaño de página reinicia el recorrido: la página 5 de 10 en 10
   *  no es la página 5 de 50 en 50. */
  protected changePerPage(value: string): void {
    const perPage = Number(value);

    if (!PER_PAGE_OPTIONS.includes(perPage) || perPage === this.perPage()) {
      return;
    }

    this.perPage.set(perPage);
    this.page.set(1);
    this.load();
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.page()) {
      return;
    }

    this.page.set(page);
    this.load();
  }

  protected toggleDeleted(): void {
    this.includeDeleted.update((value) => !value);
    // Mostrar u ocultar los eliminados cambia el total: quedarse en la página
    // 7 de una lista que ahora tiene 3 dejaría la tabla vacía.
    this.page.set(1);
    this.load();
  }

  /**
   * Vuelca la página recibida.
   *
   * Si la página en la que estaba el usuario se quedó sin filas —borró el
   * último registro de la última página— se retrocede en vez de mostrar una
   * tabla vacía con el paginador diciendo que hay registros.
   */
  private applyPage(page: NotificationRecipientsPage): void {
    this.rows.set(page.data);
    this.lastPage.set(page.last_page);
    this.total.set(page.total);
    this.notifiableCount.set(page.notifiable);

    if (page.data.length === 0 && page.current_page > 1) {
      this.page.set(page.last_page);
      this.load();

      return;
    }

    this.page.set(page.current_page);
  }

  protected onTyped(value: string): void {
    this.typed.set(value);
    this.form.patchValue({ emails: value });
  }

  protected openCreate(): void {
    this.editingUuid.set(null);
    this.form.reset({ emails: '' });
    this.typed.set('');
    this.submitted.set(false);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(row: NotificationRecipient): void {
    this.editingUuid.set(row.uuid);
    this.form.reset({ emails: row.email });
    this.typed.set(row.email);
    this.submitted.set(false);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);

    const emails = this.detected();

    if (emails.length === 0) {
      this.formError.set('Escriba al menos un correo.');
      return;
    }

    const uuid = this.editingUuid();

    // ⚠️ Editando solo se admite UNO. Aceptar varios aquí obligaría a decidir
    // si el registro se reemplaza o se multiplica, y ninguna de las dos es lo
    // que la persona pidió al pulsar el lápiz de una fila.
    if (uuid && emails.length > 1) {
      this.formError.set('Al editar solo se puede indicar un correo.');
      return;
    }

    this.saving.set(true);

    if (uuid) {
      this.recipients.update(uuid, { email: emails[0] }).subscribe({
        next: () => this.afterSave('Destinatario actualizado.'),
        error: (error: ApiError) => this.onSaveError(error),
      });

      return;
    }

    this.recipients.createMany(emails, this.perPage()).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.formOpen.set(false);

        // El alta masiva devuelve la primera página ya con lo agregado.
        this.page.set(1);
        this.applyPage(result.recipients);

        // El mensaje lo arma el backend con el desglose: cuántos entraron,
        // cuántos ya estaban y cuántos no eran correos.
        this.feedback.set({
          variant: result.created.length > 0 ? 'success' : 'error',
          message: this.summaryOf(result.created.length, result.duplicates, result.invalid),
        });

        if (this.includeDeleted()) {
          this.load();
        }
      },
      error: (error: ApiError) => this.onSaveError(error),
    });
  }

  /**
   * Pausar no es lo mismo que eliminar: pausado sigue en la lista y puede
   * volver a encenderse, eliminado ya no está. Se ofrecen las dos.
   */
  protected togglePause(row: NotificationRecipient): void {
    this.busyUuid.set(row.uuid);

    this.recipients.update(row.uuid, { isActive: !row.isActive }).subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.feedback.set({
          variant: 'success',
          message: row.isActive
            ? `${row.email} deja de recibir el aviso.`
            : `${row.email} vuelve a recibir el aviso.`,
        });
        this.load();
      },
      error: (error: ApiError) => {
        this.busyUuid.set(null);
        this.feedback.set({ variant: 'error', message: error.message });
      },
    });
  }

  protected confirmDelete(row: NotificationRecipient): void {
    this.confirming.set({
      title: 'Eliminar destinatario',
      message: `${row.email} dejará de recibir el aviso del tipo de cambio. Puede volver a agregarlo después.`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
      run: () => this.run(row, this.recipients.delete(row.uuid), 'Destinatario eliminado.'),
    });
  }

  protected confirmRestore(row: NotificationRecipient): void {
    this.confirming.set({
      title: 'Restaurar destinatario',
      message: `${row.email} volverá a la lista y recibirá el aviso.`,
      confirmLabel: 'Restaurar',
      variant: 'primary',
      run: () => this.run(row, this.recipients.restore(row.uuid), 'Destinatario restaurado.'),
    });
  }

  protected acceptConfirm(): void {
    const pending = this.confirming();
    this.confirming.set(null);
    pending?.run();
  }

  protected dismissConfirm(): void {
    this.confirming.set(null);
  }

  /**
   * Separa por `;`, que es lo que se le indica al usuario.
   *
   * También se aceptan coma y salto de línea sin anunciarlos: es lo que sale
   * al copiar de Outlook o de una hoja de cálculo, y rechazarlo obligaría a
   * reescribir a mano una lista que ya se tenía.
   *
   * Se quitan los vacíos —un `;` final es lo normal al pegar— y los
   * repetidos dentro del mismo texto.
   */
  private split(value: string): string[] {
    const parts = value
      .split(/[;,\n\r]+/)
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0);

    return [...new Set(parts)];
  }

  private summaryOf(created: number, duplicates: string[], invalid: string[]): string {
    const parts: string[] = [];

    parts.push(created === 1 ? '1 correo agregado' : `${created} correos agregados`);

    if (duplicates.length > 0) {
      parts.push(
        duplicates.length === 1
          ? `1 ya estaba en la lista (${duplicates[0]})`
          : `${duplicates.length} ya estaban en la lista`,
      );
    }

    if (invalid.length > 0) {
      parts.push(
        invalid.length === 1
          ? `1 no es un correo válido (${invalid[0]})`
          : `${invalid.length} no son correos válidos`,
      );
    }

    return `${parts.join(', ')}.`;
  }

  private afterSave(message: string): void {
    this.saving.set(false);
    this.formOpen.set(false);
    this.feedback.set({ variant: 'success', message });
    this.load();
  }

  private onSaveError(error: ApiError): void {
    this.saving.set(false);

    const first = error.validation ? Object.values(error.validation)[0]?.[0] : null;

    this.formError.set(first ?? error.message);
  }

  private run(
    row: NotificationRecipient,
    request: ReturnType<NotificationRecipientsService['delete']>,
    message: string,
  ): void {
    this.busyUuid.set(row.uuid);

    request.subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.feedback.set({ variant: 'success', message });
        this.load();
      },
      error: (error: ApiError) => {
        this.busyUuid.set(null);
        this.feedback.set({ variant: 'error', message: error.message });
      },
    });
  }
}
