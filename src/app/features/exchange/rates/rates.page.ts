import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ExchangeService } from '../../../core/exchange/exchange.service';
import { ApiError, Paginated } from '../../../core/models/api.models';
import { RateSource } from '../../../core/models/dashboard.models';
import { AuditEntry, ExchangeRateRow } from '../../../core/models/exchange.models';
import { Alert } from '../../../shared/alert/alert';
import { Icon } from '../../../shared/icon/icon';
import { Modal, ModalFooter } from '../../../shared/modal/modal';
import { applyServerErrors, controlError } from '../../../shared/form/form-errors';

type Feedback = { variant: 'success' | 'error'; message: string } | null;

/** Evento de dominio que registra la corrección manual con su motivo. */
const MANUAL_OVERRIDE = 'exchangeRate.manualOverride';

/** Movimiento del historial, ya traducido a texto. */
interface HistoryEntry {
  uuid: string;
  title: string;
  detail: string;
  actorName: string;
  occurredAt: string | null;
}

/**
 * Gestión de Tipo de Cambio: histórico de los valores aplicables, corrección
 * manual del día en curso y del día hábil siguiente, e historial por registro.
 */
@Component({
  selector: 'app-rates-page',
  imports: [ReactiveFormsModule, DatePipe, Alert, Icon, Modal, ModalFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rates.page.html',
})
export class RatesPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly exchange = inject(ExchangeService);

  protected readonly page = signal<Paginated<ExchangeRateRow> | null>(null);
  protected readonly loading = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback>(null);
  protected readonly busyUuid = signal<string | null>(null);

  protected readonly month = signal('');
  protected readonly source = signal<RateSource | ''>('');
  protected readonly includeDeleted = signal(false);

  protected readonly rows = computed(() => this.page()?.data ?? []);
  protected readonly total = computed(() => this.page()?.total ?? 0);
  protected readonly currentPage = computed(() => this.page()?.current_page ?? 1);
  protected readonly lastPage = computed(() => this.page()?.last_page ?? 1);

  // ---------------------------------------------------------- edición manual

  protected readonly editing = signal<ExchangeRateRow | null>(null);
  protected readonly saving = signal(false);
  protected readonly editError = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    manualRate: [0, [Validators.required, Validators.min(0.000001)]],
    reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
  });

  // ----------------------------------------------------------------- borrado

  protected readonly deleting = signal<ExchangeRateRow | null>(null);

  // ---------------------------------------------------------------- historial

  protected readonly historyOf = signal<ExchangeRateRow | null>(null);
  protected readonly history = signal<HistoryEntry[]>([]);
  protected readonly historyLoading = signal(false);

  constructor() {
    this.load();
  }

  protected error(field: string): string | null {
    return controlError(this.form.get(field));
  }

  protected load(page = 1): void {
    this.loading.set(true);
    this.listError.set(null);

    this.exchange
      .rates({
        month: this.month() || undefined,
        source: this.source(),
        includeDeleted: this.includeDeleted(),
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

  protected changeMonth(value: string): void {
    this.month.set(value);
    this.load();
  }

  protected changeSource(value: string): void {
    this.source.set(value as RateSource | '');
    this.load();
  }

  protected toggleDeleted(checked: boolean): void {
    this.includeDeleted.set(checked);
    this.load();
  }

  protected goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.load(page);
    }
  }

  protected dayLabel(row: ExchangeRateRow): string | null {
    return row.dayTag === 'today' ? 'Hoy' : row.dayTag === 'next' ? 'Siguiente' : null;
  }

  // ---------------------------------------------------------- edición manual

  protected openEdit(row: ExchangeRateRow): void {
    this.editing.set(row);
    this.editError.set(null);
    this.form.reset({
      manualRate: Number(row.manualRate ?? row.effectiveRate ?? row.calculatedRate ?? 0),
      reason: '',
    });
  }

  protected closeEdit(): void {
    this.editing.set(null);
  }

  protected save(): void {
    const row = this.editing();

    if (!row || this.saving()) {
      return;
    }

    this.editError.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);

    this.exchange.setManualRate(row.uuid, this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.feedback.set({
          variant: 'success',
          message: `Tipo de cambio del ${row.applicableDate} actualizado. El valor calculado se conserva.`,
        });
        this.load(this.currentPage());
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        const unmatched = applyServerErrors(this.form, error.validation);
        this.editError.set(unmatched[0] ?? error.message);
      },
    });
  }

  // ----------------------------------------------------------------- borrado

  protected askDelete(row: ExchangeRateRow): void {
    this.deleting.set(row);
  }

  protected cancelDelete(): void {
    this.deleting.set(null);
  }

  protected confirmDelete(): void {
    const row = this.deleting();
    this.deleting.set(null);

    if (!row) {
      return;
    }

    this.busyUuid.set(row.uuid);

    this.exchange.deleteRate(row.uuid).subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.feedback.set({
          variant: 'success',
          message: `Registro del ${row.applicableDate} eliminado.`,
        });
        this.load(this.currentPage());
      },
      error: (error: ApiError) => {
        this.busyUuid.set(null);
        const detail = error.validation ? Object.values(error.validation)[0]?.[0] : null;
        this.feedback.set({ variant: 'error', message: detail ?? error.message });
      },
    });
  }

  // ---------------------------------------------------------------- historial

  protected openHistory(row: ExchangeRateRow): void {
    this.historyOf.set(row);
    this.history.set([]);
    this.historyLoading.set(true);

    this.exchange.recordHistory('exchangerates', row.uuid).subscribe({
      next: (result) => {
        this.history.set(this.toHistoryList(result.data));
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  protected closeHistory(): void {
    this.historyOf.set(null);
  }

  /**
   * Traduce la entrada de auditoría a la línea del historial.
   *
   * Cada corrección manual deja dos rastros: el cambio del modelo y el evento
   * de dominio con el motivo. En pantalla sólo se muestra el segundo, que dice
   * lo mismo y además explica el porqué; se identifican por compartir la
   * solicitud que los originó.
   */
  private toHistoryList(entries: AuditEntry[]): HistoryEntry[] {
    const requestsWithOverride = new Set(
      entries
        .filter((entry) => entry.event === MANUAL_OVERRIDE && entry.request?.uuid)
        .map((entry) => entry.request!.uuid),
    );

    // El valor previo llega en el evento desde que se registra; para los
    // movimientos anteriores a ese cambio se recupera del rastro del modelo,
    // que sí guardó el `effectiveRate` que se reemplazó.
    const previousByRequest = new Map<string, unknown>();

    entries
      .filter((entry) => entry.event === 'updated' && entry.request?.uuid)
      .forEach((entry) => {
        const previous = entry.oldValues?.['effectiveRate'];

        if (previous !== undefined && !previousByRequest.has(entry.request!.uuid)) {
          previousByRequest.set(entry.request!.uuid, previous);
        }
      });

    return entries
      .filter(
        (entry) =>
          entry.event === MANUAL_OVERRIDE ||
          !entry.request?.uuid ||
          !requestsWithOverride.has(entry.request.uuid),
      )
      .map((entry) =>
        this.toHistory(entry, previousByRequest.get(entry.request?.uuid ?? '')),
      );
  }

  private toHistory(entry: AuditEntry, fallbackPrevious?: unknown): HistoryEntry {
    const values = entry.newValues ?? {};

    if (entry.event === MANUAL_OVERRIDE) {
      // El valor reemplazado es el que estaba vigente, haya venido del cálculo
      // automático o de una captura manual anterior.
      const previous =
        values['previousEffectiveRate'] ?? fallbackPrevious ?? values['previousManualRate'];

      return {
        uuid: entry.uuid,
        title: 'Corrección manual',
        detail:
          `${this.rateText(previous)} → ${this.rateText(values['manualRate'])}` +
          ` · Calculado por el sistema: ${this.rateText(values['calculatedRate'])}` +
          ` · Motivo: ${values['reason'] ?? '—'}`,
        actorName: entry.actorName,
        occurredAt: entry.occurredAt,
      };
    }

    if (entry.event === 'created') {
      const published = values['publishedRate'];
      const publishedDate = String(values['publishedDate'] ?? '').slice(0, 10);
      const factor = values['factorValue'];

      return {
        uuid: entry.uuid,
        title: 'Cálculo automático del sistema',
        detail:
          `— → ${this.rateText(values['effectiveRate'])}` +
          (published ? ` · Publicación Banxico ${this.rateText(published)}` : '') +
          (publishedDate ? ` (${publishedDate})` : '') +
          (factor ? ` · factor ${this.factorText(factor)}` : ''),
        actorName: entry.actorName,
        occurredAt: entry.occurredAt,
      };
    }

    return {
      uuid: entry.uuid,
      title: entry.eventLabel,
      detail: this.changesText(entry),
      actorName: entry.actorName,
      occurredAt: entry.occurredAt,
    };
  }

  /** Muestra el valor anterior y el nuevo de cada columna que cambió. */
  private changesText(entry: AuditEntry): string {
    const labels: Record<string, string> = {
      publishedRate: 'Publicación Banxico',
      publishedDate: 'Fecha de publicación',
      factorValue: 'Factor',
      calculatedRate: 'Valor calculado',
      manualRate: 'Valor manual',
      effectiveRate: 'Vigente',
      manualReason: 'Motivo',
      deletedAt: 'Estado',
    };

    const parts = (entry.changedColumns ?? [])
      .filter((column) => column in labels)
      .map((column) => {
        const before = entry.oldValues?.[column];
        const after = entry.newValues?.[column];

        return `${labels[column]}: ${this.columnText(column, before)} → ${this.columnText(column, after)}`;
      });

    return parts.length ? parts.join(' · ') : 'Sin cambios de valor';
  }

  private columnText(column: string, value: unknown): string {
    if (column === 'deletedAt') {
      return value ? 'Eliminado' : 'Vigente';
    }

    if (column === 'manualReason' || column === 'publishedDate') {
      return value === null || value === undefined ? '—' : String(value).slice(0, 10);
    }

    return column === 'factorValue' ? this.factorText(value) : this.rateText(value);
  }

  /** Los tipos de cambio se leen con 4 decimales. */
  private rateText(value: unknown): string {
    return value === null || value === undefined ? '—' : Number(value).toFixed(4);
  }

  /** El factor, con 3. */
  private factorText(value: unknown): string {
    return value === null || value === undefined ? '—' : Number(value).toFixed(3);
  }
}
