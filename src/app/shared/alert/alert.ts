import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon, IconName } from '../icon/icon';

export type AlertVariant = 'error' | 'success' | 'warning' | 'info';

const STYLES: Record<AlertVariant, { box: string; icon: IconName }> = {
  error: { box: 'border-danger-600/30 bg-red-50 text-danger-600', icon: 'alert' },
  success: { box: 'border-success-600/30 bg-emerald-50 text-success-600', icon: 'check' },
  warning: { box: 'border-brand-300 bg-brand-50 text-warning-600', icon: 'alert' },
  info: { box: 'border-hairline bg-canvas text-ink-600', icon: 'alert' },
};

@Component({
  selector: 'app-alert',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-start gap-2.5 rounded-md border px-4 py-3 text-sm" [class]="box()">
      <span class="mt-0.5 shrink-0"><app-icon [name]="icon()" [size]="18" /></span>
      <div class="min-w-0">
        <p class="font-medium">{{ message() }}</p>
        <ng-content />
      </div>
    </div>
  `,
})
export class Alert {
  readonly variant = input<AlertVariant>('error');
  readonly message = input.required<string>();

  protected readonly box = computed(() => STYLES[this.variant()].box);
  protected readonly icon = computed(() => STYLES[this.variant()].icon);
}
