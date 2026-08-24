import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';

/** Rutas que gestionan la sesión por su cuenta y no deben redirigir. */
const SELF_HANDLED = ['auth/login', 'auth/verify', 'auth/logout'];

/**
 * Envía las credenciales en cada petición (la sesión es una cookie httpOnly) y
 * reacciona a las respuestas que terminan la sesión.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const withCredentials = request.clone({ withCredentials: true });
  const selfHandled = SELF_HANDLED.some((path) => request.url.includes(path));

  return next(withCredentials).pipe(
    catchError((error: HttpErrorResponse) => {
      if (selfHandled) {
        return throwError(() => error);
      }

      // 401: token ausente, inválido o sesión expirada en el servidor.
      if (error.status === 401) {
        auth.clear();
        void router.navigate(['/login'], { queryParams: { reason: 'expired' }, replaceUrl: true });
      }

      // 423: usuario o IP bloqueados mientras la sesión seguía abierta.
      if (error.status === 423) {
        auth.clear();
        void router.navigate(['/login'], { queryParams: { reason: 'blocked' }, replaceUrl: true });
      }

      return throwError(() => error);
    }),
  );
};
