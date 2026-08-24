import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  History,
  LayoutGrid,
  Lock,
  LogOut,
  LucideAngularModule,
  LucideIconData,
  Mail,
  PanelLeft,
  Settings,
  SquarePen,
  Trash2,
  TriangleAlert,
  User,
  Users,
  X,
} from 'lucide-angular';

/**
 * Nombres propios del portal asociados a su icono de Lucide.
 *
 * Las plantillas piden el icono por lo que significa (`edit`, `history`) y no
 * por cómo se llama en la librería: cambiar el trazo de una acción se hace aquí
 * y no en cada plantilla. Al importar sólo los iconos usados, el resto del
 * catálogo no entra al paquete final.
 */
const ICONS = {
  home: LayoutGrid,
  settings: Settings,
  users: Users,
  user: User,
  logout: LogOut,
  chevron: ChevronDown,
  sidebar: PanelLeft,
  lock: Lock,
  alert: TriangleAlert,
  check: Check,
  clock: Clock,
  mail: Mail,
  eye: Eye,
  eyeOff: EyeOff,
  close: X,
  edit: SquarePen,
  trash: Trash2,
  history: History,
  exchange: ArrowLeftRight,
  arrowupright: ArrowUpRight
} satisfies Record<string, LucideIconData>;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lucide-icon
      [img]="icon()"
      [size]="size()"
      [strokeWidth]="strokeWidth()"
      class="inline-flex"
      aria-hidden="true"
    />
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  /** Algo más fino que el trazo por omisión de Lucide, que es 2. */
  readonly strokeWidth = input(1.8);

  protected readonly icon = computed(() => ICONS[this.name()]);
}
