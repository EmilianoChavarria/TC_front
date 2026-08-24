import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ExchangeService } from '../../../core/exchange/exchange.service';
import { ApiError } from '../../../core/models/api.models';
import { AuditEntry, ExchangeFactor } from '../../../core/models/exchange.models';
import { Alert } from '../../../shared/alert/alert';
import { Icon } from '../../../shared/icon/icon';
import { Modal, ModalFooter } from '../../../shared/modal/modal';
import { applyServerErrors, controlError } from '../../../shared/form/form-errors';

type Feedback = { variant: 'success' | 'error'; message: string } | null;

/** Movimiento del historial de un factor, ya traducido a texto. */
interface HistoryEntry {
  uuid: string;
  title: string;
  detail: string;
  actorName: string;
  occurredAt: string | null;
}

/**
 * Administración de Factores: rangos de la publicación de Banxico y el factor
 * que se aplica en cada uno.
 */
@Component({
  selector: 'app-factors-page',
  imports: [ReactiveFormsModule, DatePipe, Alert, Icon, Modal, ModalFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './factors.page.html',
})
export class FactorsPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly exchange = inject(ExchangeService);

  protected readonly factors = signal<ExchangeFactor[]>([]);
  protected readonly loading = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback>(null);
  protected readonly includeDeleted = signal(false);
  protected readonly busyUuid = signal<string | null>(null);

  protected readonly editing = signal<ExchangeFactor | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly deleting = signal<ExchangeFactor | null>(null);

  protected readonly historyOf = signal<ExchangeFactor | null>(null);
  protected readonly history = signal<HistoryEntry[]>([]);
  protected readonly historyLoading = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    rangeFrom: [0, [Validators.required, Validators.min(0)]],
    rangeTo: [0, [Validators.required, Validators.min(0)]],
    factor: [1, [Validators.required, Validators.min(0.000001)]],
  });

  protected readonly modalTitle = computed(() =>
    this.editing() ? `Editar factor · Clave ${this.editing()!.code}` : 'Nuevo factor',
  );

  constructor() {
    this.load();
  }

  protected error(field: string): string | null {
    return controlError(this.form.get(field));
  }

  protected load(): void {
    this.loading.set(true);
    this.listError.set(null);

    this.exchange.factors(this.includeDeleted()).subscribe({
      next: (factors) => {
        this.factors.set(factors);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.listError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  protected toggleDeleted(checked: boolean): void {
    this.includeDeleted.set(checked);
    this.load();
  }

  // -------------------------------------------------------------------- altas

  protected openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({ rangeFrom: 0, rangeTo: 0, factor: 1 });
    this.formOpen.set(true);
  }

  protected openEdit(factor: ExchangeFactor): void {
    this.editing.set(factor);
    this.formError.set(null);
    this.form.reset({
      rangeFrom: Number(factor.rangeFrom),
      rangeTo: Number(factor.rangeTo),
      factor: Number(factor.factor),
    });
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
      ? this.exchange.updateFactor(current.uuid, payload)
      : this.exchange.createFactor(payload);

    this.saving.set(true);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.feedback.set({
          variant: 'success',
          message: current ? 'Factor actualizado.' : 'Factor registrado.',
        });
        this.load();
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        const unmatched = applyServerErrors(this.form, error.validation);
        this.formError.set(unmatched[0] ?? error.message);
      },
    });
  }

  // ----------------------------------------------------------------- acciones

  protected askDelete(factor: ExchangeFactor): void {
    this.deleting.set(factor);
  }

  protected cancelDelete(): void {
    this.deleting.set(null);
  }

  protected confirmDelete(): void {
    const factor = this.deleting();
    this.deleting.set(null);

    if (!factor) {
      return;
    }

    this.run(factor, this.exchange.deleteFactor(factor.uuid), `Clave ${factor.code} eliminada.`);
  }

  protected restore(factor: ExchangeFactor): void {
    this.run(factor, this.exchange.restoreFactor(factor.uuid), `Clave ${factor.code} restaurada.`);
  }

  private run(
    factor: ExchangeFactor,
    request: ReturnType<ExchangeService['deleteFactor']>,
    successMessage: string,
  ): void {
    this.busyUuid.set(factor.uuid);
    this.feedback.set(null);

    request.subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.feedback.set({ variant: 'success', message: successMessage });
        this.load();
      },
      error: (error: ApiError) => {
        this.busyUuid.set(null);
        const detail = error.validation ? Object.values(error.validation)[0]?.[0] : null;
        this.feedback.set({ variant: 'error', message: detail ?? error.message });
      },
    });
  }

  // ---------------------------------------------------------------- historial

  /** Movimientos de un factor concreto, tomados de la auditoría. */
  protected openHistory(factor: ExchangeFactor): void {
    this.historyOf.set(factor);
    this.history.set([]);
    this.historyLoading.set(true);

    this.exchange.recordHistory('exchangeratefactors', factor.uuid).subscribe({
      next: (result) => {
        this.history.set(result.data.map((entry) => this.toHistory(entry)));
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  protected closeHistory(): void {
    this.historyOf.set(null);
  }

  /**
   * Traduce una entrada de auditoría a la línea del historial:
   * «Actualización de factor / 1.004 → 1.005».
   */
  private toHistory(entry: AuditEntry): HistoryEntry {
    const titles: Record<string, string> = {
      created: 'Alta de factor',
      updated: 'Actualización de factor',
      softDeleted: 'Eliminación lógica',
      restored: 'Restauración de factor',
      deleted: 'Eliminación de factor',
    };

    return {
      uuid: entry.uuid,
      title: titles[entry.event] ?? entry.eventLabel,
      detail: this.detailOf(entry),
      actorName: entry.actorName,
      occurredAt: entry.occurredAt,
    };
  }

  /**
   * El alta muestra los valores iniciales; el resto, sólo las columnas que
   * cambiaron, con su valor anterior y el nuevo.
   */
  private detailOf(entry: AuditEntry): string {
    if (entry.event === 'created') {
      const values = entry.newValues ?? {};

      return (
        `Valor inicial ${this.factorText(values['factor'])} · ` +
        `rango ${this.rateText(values['rangeFrom'])} a ${this.rateText(values['rangeTo'])}`
      );
    }

    const labels: Record<string, string> = {
      factor: 'Factor',
      rangeFrom: 'Desde',
      rangeTo: 'Hasta',
      deletedAt: 'Estado',
    };

    const parts = (entry.changedColumns ?? [])
      .filter((column) => column in labels)
      .map((column) => {
        const before = entry.oldValues?.[column];
        const after = entry.newValues?.[column];

        return `${labels[column]}: ${this.valueText(column, before)} → ${this.valueText(column, after)}`;
      });

    return parts.length ? parts.join(' · ') : 'Sin cambios de valor';
  }

  private valueText(column: string, value: unknown): string {
    if (column === 'deletedAt') {
      return value ? 'Eliminado' : 'Vigente';
    }

    return column === 'factor' ? this.factorText(value) : this.rateText(value);
  }

  /** Los tipos de cambio y los límites del rango van a 4 decimales. */
  private rateText(value: unknown): string {
    return value === null || value === undefined ? '—' : Number(value).toFixed(4);
  }

  /** El factor va a 3 decimales. */
  private factorText(value: unknown): string {
    return value === null || value === undefined ? '—' : Number(value).toFixed(3);
  }
}
