import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withEnabledBlockingInitialNavigation,
  withHashLocation,
} from '@angular/router';

import { of } from 'rxjs';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/http/auth.interceptor';

/**
 * Recupera la sesión antes de pintar la primera pantalla.
 *
 * La cookie httpOnly no es legible desde JavaScript, así que la única forma de
 * saber si hay sesión es preguntarle al backend. Un fallo sólo significa «no
 * hay sesión»: la aplicación arranca como invitado.
 */
function restoreSession() {
  const auth = inject(AuthService);
  const path = inject(DOCUMENT).location?.pathname ?? '/';

  // ⚠️ En la consulta pública NO se pregunta por la sesión. Ese `auth/verify`
  // sería la única pista de que hay un portal detrás: sale en la red del
  // navegador y responde 401 a quien sólo viene a ver el tipo de cambio. Quien
  // entra al portal resuelve la sesión en el guard de todos modos.
  if (path === '/') {
    return of(false);
  }

  return auth.ensureSession();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // ⚠️ `withEnabledBlockingInitialNavigation` no es cosmético: sin él la
    // primera navegación arranca EN PARALELO con la recuperación de la sesión,
    // los guards se evalúan sin saber todavía quién es el usuario y una recarga
    // de página termina en el login.
    provideRouter(routes, withEnabledBlockingInitialNavigation(), withComponentInputBinding(), withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(restoreSession),
  ],
};
