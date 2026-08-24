/** Envoltura uniforme que devuelve el backend (App\Support\ApiResponse). */
export interface ApiResponse<T> {
  codeStatus: number;
  success: boolean;
  message: string;
  data: T;
  errors: unknown;
  timestamp: string;
}

/** Errores de validación de Laravel: campo -> mensajes. */
export type ValidationErrors = Record<string, string[]>;

/** Paginador de Laravel. */
export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** Error ya normalizado para la interfaz. */
export interface ApiError {
  status: number;
  message: string;
  validation: ValidationErrors | null;
  /** El backend responde 403 con este dato cuando falta cambiar la contraseña. */
  mustChangePassword: boolean;
}
