import { RoleName } from '../../core/models/auth.models';
import { IconName } from '../../shared/icon/icon';

export interface NavItem {
  label: string;
  route: string;
  icon: IconName;
  /** Roles que ven la entrada; vacío significa "cualquier sesión". */
  roles?: RoleName[];
}

export interface NavGroup {
  label: string;
  icon: IconName;
  items: NavItem[];
  roles?: RoleName[];
}

/**
 * Menú lateral. Las entradas de módulos aún no construidos se agregarán aquí
 * conforme lleguen; el shell ya soporta grupos plegables.
 */
export const NAV_ITEMS: NavItem[] = [{ label: 'Inicio', route: '/inicio', icon: 'home' }];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Tipo de Cambio',
    icon: 'exchange',
    items: [
      { label: 'Gestión de Tipo de Cambio', route: '/tipo-de-cambio', icon: 'exchange' },
      {
        label: 'Administración de Factores',
        route: '/factores',
        icon: 'settings',
        roles: ['SUPERADMIN', 'ADMIN'],
      },
      {
        label: 'Días feriados',
        route: '/dias-feriados',
        icon: 'calendar',
        roles: ['SUPERADMIN', 'ADMIN'],
      },
    ],
  },
  {
    label: 'Configuración',
    icon: 'settings',
    roles: ['SUPERADMIN', 'ADMIN'],
    items: [
      { label: 'Gestión de Usuarios', route: '/usuarios', icon: 'users' },
      { label: 'Correos de notificación', route: '/correos-notificacion', icon: 'mail' },
    ],
  },
];
