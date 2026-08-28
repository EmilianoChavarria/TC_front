import { Routes } from '@angular/router';

import { adminGuard, authGuard, guestGuard, passwordChangeGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  /*
   * Consulta pública. Es la raíz del sitio a propósito: quien llega desde
   * internet ve el tipo de cambio, no una pantalla de acceso. No lleva guard
   * porque no hay nada que proteger, y vive fuera del `Shell` para que no
   * arrastre menú, sesión ni ninguna otra señal del portal.
   */
  {
    path: '',
    pathMatch: 'full',
    title: 'Tipo de Cambio México · Timken',
    loadComponent: () =>
      import('./features/public/public-rate.page').then((m) => m.PublicRatePage),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Iniciar sesión · Portal de Tipo de Cambio',
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'cambiar-contrasena',
    canActivate: [passwordChangeGuard],
    title: 'Cambiar contraseña · Portal de Tipo de Cambio',
    loadComponent: () =>
      import('./features/auth/change-password/change-password.page').then(
        (m) => m.ChangePasswordPage,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'inicio',
        title: 'Inicio · Portal de Tipo de Cambio',
        loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'tipo-de-cambio',
        title: 'Gestión de Tipo de Cambio · Portal de Tipo de Cambio',
        loadComponent: () =>
          import('./features/exchange/rates/rates.page').then((m) => m.RatesPage),
      },
      {
        path: 'factores',
        canActivate: [adminGuard],
        title: 'Administración de Factores · Portal de Tipo de Cambio',
        loadComponent: () =>
          import('./features/exchange/factors/factors.page').then((m) => m.FactorsPage),
      },
      {
        path: 'dias-feriados',
        canActivate: [adminGuard],
        title: 'Días feriados · Portal de Tipo de Cambio',
        loadComponent: () =>
          import('./features/holidays/holidays.page').then((m) => m.HolidaysPage),
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        title: 'Gestión de Usuarios · Portal de Tipo de Cambio',
        loadComponent: () => import('./features/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'correos-notificacion',
        canActivate: [adminGuard],
        title: 'Correos de notificación · Portal de Tipo de Cambio',
        loadComponent: () =>
          import('./features/notifications/recipients.page').then((m) => m.RecipientsPage),
      },
      {
        path: 'configuracion-sistema',
        canActivate: [adminGuard],
        title: 'Configuración del Sistema · Portal de Tipo de Cambio',
        loadComponent: () =>
          import('./features/settings/system-settings.page').then((m) => m.SystemSettingsPage),
      },
      {
        path: 'seguridad',
        canActivate: [adminGuard],
        title: 'Gestión de Seguridad · Portal de Tipo de Cambio',
        loadComponent: () =>
          import('./features/security/security.page').then((m) => m.SecurityPage),
      },
      {
        path: 'mi-cuenta',
        title: 'Mi cuenta · Portal de Tipo de Cambio',
        loadComponent: () => import('./features/account/account.page').then((m) => m.AccountPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
