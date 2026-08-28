import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { HolidaysService } from '../../core/holidays/holidays.service';
import { ApiError } from '../../core/models/api.models';
import { BulkHolidayItem, Holiday, HolidayStatus } from '../../core/models/holiday.models';
import { Alert } from '../../shared/alert/alert';
import { applyServerErrors, controlError } from '../../shared/form/form-errors';
import { Icon } from '../../shared/icon/icon';
import { Modal, ModalFooter } from '../../shared/modal/modal';

type Feedback = { variant: 'success' | 'error'; message: string } | null;

/** Línea del pegado masivo ya interpretada. */
interface ParsedLine {
  line: number;
  raw: string;
  holidayDate: string;
  description: string;
  error: string | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Días feriados del calendario bancario.
 *
 * No es una lista informativa: de aquí sale el día hábil siguiente con el que
 * se fecha el tipo de cambio. Un feriado sin capturar hace que la publicación
 * del viernes se aplique a un lunes festivo en vez de al martes.
 */
@Component({
  selector: 'app-holidays-page',
  imports: [ReactiveFormsModule, DatePipe, Alert, Icon, Modal, ModalFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './holidays.page.html',
})
export class HolidaysPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly holidays = inject(HolidaysService);

  protected readonly rows = signal<Holiday[]>([]);
  protected readonly status = signal<HolidayStatus | null>(null);
  protected readonly loading = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback>(null);
  protected readonly includeDeleted = signal(false);
  protected readonly busyUuid = signal<string | null>(null);

  /** Año en pantalla; arranca en el actual y se ajusta al llegar el estado. */
  protected readonly year = signal(new Date().getFullYear());

  /** Años que el backend admite capturar (el actual y `years_ahead` adelante). */
  protected readonly years = computed(() => this.status()?.years.map((item) => item.year) ?? []);

  protected readonly activeCount = computed(
    () => this.rows().filter((row) => !row.isDeleted).length,
  );

  // ----------------------------------------------------------- alta y edición

  protected readonly editing = signal<Holiday | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    holidayDate: ['', [Validators.required]],
    description: ['', [Validators.required, Validators.maxLength(150)]],
  });

  protected readonly modalTitle = computed(() =>
    this.editing() ? 'Editar día feriado' : `Nuevo día feriado · ${this.year()}`,
  );

  // ------------------------------------------------------------ alta por lote

  protected readonly bulkOpen = signal(false);
  protected readonly bulkSaving = signal(false);
  protected readonly bulkError = signal<string | null>(null);
  protected readonly bulkText = signal('');

  /**
   * Lo pegado, línea por línea.
   *
   * Se interpreta mientras se escribe y no al enviar: el lote es todo o nada
   * en el backend, así que enterarse de la línea mal formada después de pulsar
   * guardar obliga a revisar el pegado entero.
   */
  protected readonly parsed = computed(() => this.parse(this.bulkText()));
  protected readonly parsedValid = computed(() => this.parsed().filter((line) => !line.error));
  protected readonly parsedInvalid = computed(() => this.parsed().filter((line) => line.error));

  protected readonly deleting = signal<Holiday | null>(null);

  constructor() {
    this.loadStatus();
    this.load();
  }

  protected error(field: string): string | null {
    return controlError(this.form.get(field));
  }

  protected loadStatus(): void {
    this.holidays.status().subscribe({
      next: (status) => {
        this.status.set(status);

        // El año en pantalla debe ser uno de los capturables: entrar con un
        // año que el backend ya no admite mostraría una tabla vacía sin decir
        // por qué.
        if (!status.years.some((item) => item.year === this.year())) {
          this.year.set(status.currentYear);
          this.load();
        }
      },
      error: (error: ApiError) => this.listError.set(error.message),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.listError.set(null);

    this.holidays.list(this.year(), this.includeDeleted()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.listError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  protected changeYear(value: string): void {
    const year = Number(value);

    if (!Number.isFinite(year) || year === this.year()) {
      return;
    }

    this.year.set(year);
    this.load();
  }

  protected toggleDeleted(checked: boolean): void {
    this.includeDeleted.set(checked);
    this.load();
  }

  /** Cuántos feriados tiene un año, según el estado del backend. */
  protected totalOf(year: number): number {
    return this.status()?.years.find((item) => item.year === year)?.total ?? 0;
  }

  // ----------------------------------------------------------- alta y edición

  protected openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({ holidayDate: `${this.year()}-01-01`, description: '' });
    this.formOpen.set(true);
  }

  protected openEdit(holiday: Holiday): void {
    this.editing.set(holiday);
    this.formError.set(null);
    this.form.reset({ holidayDate: holiday.holidayDate, description: holiday.description });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }

    this.formError.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    const payload = this.form.getRawValue();
    const current = this.editing();
    const request = current
      ? this.holidays.update(current.uuid, payload)
      : this.holidays.create(payload);

    this.saving.set(true);

    request.subscribe({
      next: (holiday) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.feedback.set({
          variant: 'success',
          message: current ? 'Día feriado actualizado.' : 'Día feriado registrado.',
        });

        // Guardar una fecha de otro año sin saltar a él dejaría la impresión
        // de que no se guardó.
        this.year.set(holiday.year);
        this.refresh();
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        const unmatched = applyServerErrors(this.form, error.validation);
        this.formError.set(unmatched[0] ?? error.message);
      },
    });
  }

  // ------------------------------------------------------------ alta por lote

  protected openBulk(): void {
    this.bulkText.set('');
    this.bulkError.set(null);
    this.bulkOpen.set(true);
  }

  protected closeBulk(): void {
    this.bulkOpen.set(false);
  }

  protected onBulkTyped(value: string): void {
    this.bulkText.set(value);
  }

  protected saveBulk(): void {
    if (this.bulkSaving()) {
      return;
    }

    this.bulkError.set(null);

    const invalid = this.parsedInvalid();

    if (invalid.length > 0) {
      this.bulkError.set(`Corrija la línea ${invalid[0].line}: ${invalid[0].error}.`);
      return;
    }

    const items: BulkHolidayItem[] = this.parsedValid().map((line) => ({
      holidayDate: line.holidayDate,
      description: line.description,
    }));

    if (items.length === 0) {
      this.bulkError.set('Escriba al menos un día feriado.');
      return;
    }

    this.bulkSaving.set(true);

    this.holidays.saveMany(items).subscribe({
      next: (result) => {
        this.bulkSaving.set(false);
        this.bulkOpen.set(false);
        this.feedback.set({
          variant: 'success',
          message:
            result.saved.length === 1
              ? '1 día feriado guardado.'
              : `${result.saved.length} días feriados guardados.`,
        });

        const first = result.saved[0];

        if (first) {
          this.year.set(first.year);
        }

        this.refresh();
      },
      error: (error: ApiError) => {
        this.bulkSaving.set(false);
        this.bulkError.set(this.bulkErrorMessage(error));
      },
    });
  }

  // ---------------------------------------------------------------- acciones

  protected askDelete(holiday: Holiday): void {
    this.deleting.set(holiday);
  }

  protected cancelDelete(): void {
    this.deleting.set(null);
  }

  protected confirmDelete(): void {
    const holiday = this.deleting();
    this.deleting.set(null);

    if (!holiday) {
      return;
    }

    this.run(holiday, this.holidays.delete(holiday.uuid), 'Día feriado eliminado.');
  }

  protected restore(holiday: Holiday): void {
    this.run(holiday, this.holidays.restore(holiday.uuid), 'Día feriado restaurado.');
  }

  private run(
    holiday: Holiday,
    request: ReturnType<HolidaysService['delete']>,
    message: string,
  ): void {
    this.busyUuid.set(holiday.uuid);
    this.feedback.set(null);

    request.subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.feedback.set({ variant: 'success', message });
        this.refresh();
      },
      error: (error: ApiError) => {
        this.busyUuid.set(null);
        const detail = error.validation ? Object.values(error.validation)[0]?.[0] : null;
        this.feedback.set({ variant: 'error', message: detail ?? error.message });
      },
    });
  }

  /** La tabla y el aviso de cobertura se mueven juntos. */
  private refresh(): void {
    this.load();
    this.loadStatus();
  }

  /**
   * Interpreta el pegado: una línea por feriado, con la fecha `YYYY-MM-DD` y la
   * descripción separadas por coma, punto y coma o tabulador.
   *
   * El tabulador entra sin anunciarse porque es lo que sale al copiar de una
   * hoja de cálculo, que es de donde viene el calendario en la práctica.
   */
  private parse(value: string): ParsedLine[] {
    return value
      .split(/\r?\n/)
      .map((raw, index) => ({ raw: raw.trim(), line: index + 1 }))
      .filter((item) => item.raw.length > 0)
      .map(({ raw, line }) => {
        const separator = raw.search(/[,;\t]|\s{2,}|\s/);
        const date = (separator === -1 ? raw : raw.slice(0, separator)).trim();
        const description =
          separator === -1
            ? ''
            : raw
                .slice(separator + 1)
                .replace(/^[\s,;\t]+/, '')
                .trim();

        if (!DATE_PATTERN.test(date)) {
          return {
            line,
            raw,
            holidayDate: date,
            description,
            error: 'la fecha debe ser YYYY-MM-DD',
          };
        }

        if (description === '') {
          return { line, raw, holidayDate: date, description, error: 'falta la descripción' };
        }

        if (description.length > 150) {
          return {
            line,
            raw,
            holidayDate: date,
            description,
            error: 'la descripción excede 150 caracteres',
          };
        }

        return { line, raw, holidayDate: date, description, error: null };
      });
  }

  /**
   * El backend marca la fila exacta (`holidays.3.holidayDate`); se traduce al
   * número de línea que el usuario ve en el cuadro de texto.
   */
  private bulkErrorMessage(error: ApiError): string {
    const entry = Object.entries(error.validation ?? {})[0];

    if (!entry) {
      return error.message;
    }

    const [field, messages] = entry;
    const index = Number(field.split('.')[1]);
    const message = messages[0] ?? error.message;

    return Number.isFinite(index) ? `Línea ${index + 1}: ${message}` : message;
  }
}
