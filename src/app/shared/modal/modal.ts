import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  contentChild,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import { Icon } from '../icon/icon';

/** Marca el contenido que sustituye a los botones por omisión. */
@Directive({ selector: '[modalFooter]' })
export class ModalFooter {}

export type ModalSize = 'sm' | 'md' | 'lg';

const WIDTHS: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

/**
 * Modal reutilizable: título, contenido libre y pie con los botones por
 * omisión (Aceptar / Cancelar) o el que se proyecte con `modalFooter`.
 *
 * El componente no controla su visibilidad: el padre lo envuelve en un `@if`
 * y reacciona a `closed` y `confirmed`.
 */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.html',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class Modal {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly size = input<ModalSize>('md');

  readonly confirmLabel = input('Aceptar');
  readonly cancelLabel = input('Cancelar');
  readonly confirmDisabled = input(false);
  readonly confirmVariant = input<'primary' | 'danger'>('primary');

  /** Muestra la ✕ y permite cerrar con Escape o clic fuera. */
  readonly dismissible = input(true);
  readonly closeOnBackdrop = input(true);

  readonly closed = output<void>();
  readonly confirmed = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  protected readonly customFooter = contentChild(ModalFooter);

  /**
   * Dónde empezó el gesto. Sin esto, seleccionar texto dentro del modal y
   * soltar el botón fuera cerraría el diálogo: el clic se atribuye al ancestro
   * común, que es el fondo.
   */
  private pointerDownOnBackdrop = false;

  private readonly previouslyFocused = this.document.activeElement as HTMLElement | null;

  constructor() {
    // El fondo de la página no debe desplazarse mientras el modal está abierto.
    const body = this.document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    this.destroyRef.onDestroy(() => {
      body.style.overflow = previousOverflow;
      this.previouslyFocused?.focus?.();
    });

    queueMicrotask(() => this.panel()?.nativeElement.focus());
  }

  protected width(): string {
    return WIDTHS[this.size()];
  }

  protected onPointerDown(event: PointerEvent): void {
    this.pointerDownOnBackdrop = event.target === event.currentTarget;
  }

  /**
   * Sólo cierra cuando el gesto empezó Y terminó en el fondo. Un arrastre que
   * nace dentro del modal —o que entra en él— deja el diálogo abierto.
   */
  protected onPointerUp(event: PointerEvent): void {
    const releasedOnBackdrop = event.target === event.currentTarget;
    const shouldClose = this.pointerDownOnBackdrop && releasedOnBackdrop;

    this.pointerDownOnBackdrop = false;

    if (shouldClose && this.closeOnBackdrop() && this.dismissible()) {
      this.close();
    }
  }

  protected onEscape(): void {
    if (this.dismissible()) {
      this.close();
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  protected confirm(): void {
    this.confirmed.emit();
  }
}
