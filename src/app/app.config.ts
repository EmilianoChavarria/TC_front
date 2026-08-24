import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { catchError, of } from 'rxjs';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/http/auth.interceptor';

/**
 * Recupera la sesión antes de pintar la primera pantalla.
 *
 * La cookie httpOnly no es legible desde JavaScript, así que la única forma de
 * saber si hay sesión es preguntarle al backend. Un fallo aquí sólo significa
 * «no hay sesión»: la aplicación arranca como invitado.
 */
function restoreSession() {
  const auth = inject(AuthService);

  return auth.verify().pipe(
    catchError(() => {
      auth.clear();
      return of(null);
    }),
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(restoreSession),
  ],
};
