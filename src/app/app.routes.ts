import { Routes } from '@angular/router';

import { adminGuard, authGuard, guestGuard, passwordChangeGuard } from './core/auth/auth.guards';

export const routes: Routes = [
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
        path: 'usuarios',
        canActivate: [adminGuard],
        title: 'Gestión de Usuarios · Portal de Tipo de Cambio',
        loadComponent: () => import('./features/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'dias-feriados',
        canActivate: [adminGuard],
        title: 'Días feriados · Portal de Tipo de Cambio',
        loadComponent: () =>
          import('./features/holidays/holidays.page').then((m) => m.HolidaysPage),
      },
      {
        path: 'correos-notificacion',
        canActivate: [adminGuard],
        title: 'Correos de notificación · Portal de Tipo de Cambio',
        loadComponent: () =>
          import('./features/notifications/recipients.page').then((m) => m.RecipientsPage),
      },
      {
        path: 'mi-cuenta',
        title: 'Mi cuenta · Portal de Tipo de Cambio',
        loadComponent: () => import('./features/account/account.page').then((m) => m.AccountPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
    ],
  },
  { path: '**', redirectTo: '' },
];
