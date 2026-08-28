import { Paginated } from './api.models';
import { PasswordRequirements } from './auth.models';

/** Quién dejó la configuración como está; el backend sólo expone datos públicos. */
export interface SettingsAuthor {
  uuid: string;
  fullName: string;
}

/**
 * Requisitos de contraseña vigentes más la firma del último cambio.
 *
 * `PasswordRequirements` es lo que consume el formulario de contraseña; aquí
 * se agrega lo que sólo importa en la pantalla de configuración.
 */
export interface PasswordRequirementsSettings extends PasswordRequirements {
  updatedBy?: SettingsAuthor;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpdatePasswordRequirementsRequest {
  minLength: number;
  expirationDays: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  allowedSpecialChars: string | null;
}

/**
 * Sesión y umbrales de bloqueo.
 *
 * `attemptWindowHours` es de sólo lectura: vive en la configuración del
 * servidor (`config/security.php`) y aquí sólo sirve para decir sobre qué
 * ventana se cuentan los fallos.
 */
export interface LoginAttemptSettings {
  maxUserAttempts: number;
  maxIpAttempts: number;
  sessionTimeoutMinutes: number;
  attemptWindowHours: number;
  updatedBy?: SettingsAuthor;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpdateLoginAttemptSettingsRequest {
  maxUserAttempts: number;
  maxIpAttempts: number;
  sessionTimeoutMinutes: number;
}

/** Cifras de la cabecera de Gestión de Seguridad. */
export interface SecuritySummary {
  blockedUsers: number;
  blockedIps: number;
  attemptWindowHours: number;
}

export type BlockStatus = 'blocked' | 'unblocked';

/**
 * Fila del historial de bloqueos de usuario.
 *
 * Es historial, no lista de bloqueados: incluye los ya liberados. `isBlocked`
 * dice si sigue bloqueado hoy y `canUnblock` si tiene sentido el botón.
 */
export interface BlockedUser {
  uuid: string;
  userUuid: string | null;
  fullName: string | null;
  email: string | null;
  roleName: string | null;
  failedAttempts: number;
  reason: string | null;
  ipAddress: string | null;
  blockedAt: string | null;
  isBlocked: boolean;
  status: BlockStatus;
  canUnblock: boolean;
}

/** Fila del historial de bloqueos de IP. La dirección es el identificador. */
export interface BlockedIp {
  uuid: string;
  ipAddress: string;
  country: string | null;
  failedAttempts: number;
  reason: string | null;
  blockedAt: string | null;
  releasedAt: string | null;
  isBlocked: boolean;
  status: BlockStatus;
  canUnblock: boolean;
}

export interface BlockFilters {
  onlyActive?: boolean;
  page?: number;
  perPage?: number;
}

export type BlockedUsersPage = Paginated<BlockedUser>;
export type BlockedIpsPage = Paginated<BlockedIp>;
