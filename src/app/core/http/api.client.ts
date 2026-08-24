import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError, ApiResponse, ValidationErrors } from '../models/api.models';

type Params = Record<string, string | number | boolean | null | undefined>;

/**
 * Cliente del backend: desenvuelve `ApiResponse` y normaliza los errores para
 * que los componentes reciban siempre un `ApiError`.
 *
 * La sesión viaja en una cookie httpOnly, así que toda petición va con
 * `withCredentials`. El token no es accesible desde JavaScript por diseño.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Params): Observable<T> {
    return this.unwrap(
      this.http.get<ApiResponse<T>>(this.url(path), {
        params: this.params(params),
        withCredentials: true,
      }),
    );
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.unwrap(
      this.http.post<ApiResponse<T>>(this.url(path), body ?? {}, { withCredentials: true }),
    );
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.unwrap(
      this.http.put<ApiResponse<T>>(this.url(path), body ?? {}, { withCredentials: true }),
    );
  }

  delete<T>(path: string): Observable<T> {
    return this.unwrap(
      this.http.delete<ApiResponse<T>>(this.url(path), { withCredentials: true }),
    );
  }

  private unwrap<T>(request: Observable<ApiResponse<T>>): Observable<T> {
    return request.pipe(
      map((response) => response.data),
      catchError((error: HttpErrorResponse) => throwError(() => this.normalize(error))),
    );
  }

  private normalize(error: HttpErrorResponse): ApiError {
    const body = error.error as ApiResponse<unknown> | null;
    const errors = body?.errors;

    return {
      status: error.status,
      message: body?.message ?? this.fallbackMessage(error.status),
      validation: this.validation(errors),
      mustChangePassword:
        typeof errors === 'object' &&
        errors !== null &&
        (errors as Record<string, unknown>)['mustChangePassword'] === true,
    };
  }

  /** Distingue los errores campo -> mensajes del resto de cargas de error. */
  private validation(errors: unknown): ValidationErrors | null {
    if (typeof errors !== 'object' || errors === null) {
      return null;
    }

    const entries = Object.entries(errors as Record<string, unknown>).filter(
      ([, messages]) => Array.isArray(messages) && messages.every((m) => typeof m === 'string'),
    );

    return entries.length ? (Object.fromEntries(entries) as ValidationErrors) : null;
  }

  private fallbackMessage(status: number): string {
    if (status === 0) {
      return 'No fue posible conectar con el servidor.';
    }

    return 'Ocurrió un error inesperado. Intente de nuevo.';
  }

  private url(path: string): string {
    return `${environment.apiUrl}/${path.replace(/^\//, '')}`;
  }

  private params(params?: Params): HttpParams {
    let httpParams = new HttpParams();

    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return httpParams;
  }
}
