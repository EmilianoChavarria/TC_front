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
} from '@angular/router';

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
  return inject(AuthService).ensureSession();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // ⚠️ `withEnabledBlockingInitialNavigation` no es cosmético: sin él la
    // primera navegación arranca EN PARALELO con la recuperación de la sesión,
    // los guards se evalúan sin saber todavía quién es el usuario y una recarga
    // de página termina en el login.
    provideRouter(routes, withEnabledBlockingInitialNavigation(), withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(restoreSession),
  ],
};
