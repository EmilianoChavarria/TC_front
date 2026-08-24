import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ADMIN_ROLES, RoleName } from '../models/auth.models';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

/** Exige sesión activa y arranca el reloj de inactividad. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const session = inject(SessionService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });
  }

  // Mientras deba cambiar la contraseña, el backend rechaza el resto de la API:
  // la interfaz lo lleva ahí en lugar de mostrar pantallas que van a fallar.
  if (auth.mustChangePassword()) {
    return router.createUrlTree(['/cambiar-contrasena']);
  }

  session.start();

  return true;
};

/** Sólo para quien ya inició sesión pero aún no cambia su contraseña. */
export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  return auth.mustChangePassword() ? true : router.createUrlTree(['/inicio']);
};

/** Impide volver al login con la sesión abierta. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([auth.mustChangePassword() ? '/cambiar-contrasena' : '/inicio']);
};

/** Restringe una ruta a los roles indicados. */
export function roleGuard(...roles: RoleName[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.hasRole(...roles) ? true : router.createUrlTree(['/inicio']);
  };
}

/** Atajo para las pantallas de administración. */
export const adminGuard: CanActivateFn = roleGuard(...ADMIN_ROLES);
