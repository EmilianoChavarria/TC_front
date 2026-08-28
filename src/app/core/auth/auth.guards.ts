import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';

import { ADMIN_ROLES, RoleName } from '../models/auth.models';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

/**
 * Los guards no deciden sobre el estado en memoria: lo esperan.
 *
 * ⚠️ Al recargar la página, la sesión vive únicamente en la cookie httpOnly y
 * hay que preguntarle al backend quién es. Si el guard responde antes de esa
 * respuesta, ve «sin sesión» y manda al login a alguien que sí la tenía —que es
 * justo lo que ocurría al actualizar—. `ensureSession()` comparte una sola
 * verificación, así que esperar aquí no dispara peticiones de más.
 */
function resolved(): Observable<boolean> {
  return inject(AuthService).ensureSession();
}

/** Exige sesión activa y arranca el reloj de inactividad. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const session = inject(SessionService);
  const router = inject(Router);

  return resolved().pipe(
    map<boolean, boolean | UrlTree>(() => {
      if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });
      }

      // Mientras deba cambiar la contraseña, el backend rechaza el resto de la
      // API: la interfaz lo lleva ahí en lugar de mostrar pantallas que van a
      // fallar.
      if (auth.mustChangePassword()) {
        return router.createUrlTree(['/cambiar-contrasena']);
      }

      session.start();

      return true;
    }),
  );
};

/** Sólo para quien ya inició sesión pero aún no cambia su contraseña. */
export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return resolved().pipe(
    map<boolean, boolean | UrlTree>(() => {
      if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/login']);
      }

      return auth.mustChangePassword() ? true : router.createUrlTree(['/inicio']);
    }),
  );
};

/** Impide volver al login con la sesión abierta. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return resolved().pipe(
    map<boolean, boolean | UrlTree>(() => {
      if (!auth.isAuthenticated()) {
        return true;
      }

      return router.createUrlTree([auth.mustChangePassword() ? '/cambiar-contrasena' : '/inicio']);
    }),
  );
};

/** Restringe una ruta a los roles indicados. */
export function roleGuard(...roles: RoleName[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return resolved().pipe(
      map<boolean, boolean | UrlTree>(() =>
        auth.hasRole(...roles) ? true : router.createUrlTree(['/inicio']),
      ),
    );
  };
}

/** Atajo para las pantallas de administración. */
export const adminGuard: CanActivateFn = roleGuard(...ADMIN_ROLES);
