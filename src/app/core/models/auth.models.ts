/** Roles del sistema. No son dinámicos: el backend sólo reconoce estos tres. */
export type RoleName = 'SUPERADMIN' | 'ADMIN' | 'USER';

export const ROLE_LABELS: Record<RoleName, string> = {
  SUPERADMIN: 'Superadministrador',
  ADMIN: 'Administrador',
  USER: 'Usuario',
};

/** Roles que administran seguridad y configuración. */
export const ADMIN_ROLES: RoleName[] = ['SUPERADMIN', 'ADMIN'];

/**
 * Roles de los que sólo existe una cuenta activa. El backend rechaza el alta de
 * una segunda mientras la anterior siga vigente.
 */
export const SINGLE_ACCOUNT_ROLES: RoleName[] = ['SUPERADMIN', 'ADMIN'];

/**
 * Usuario autenticado. Se identifica por `uuid`: el backend nunca expone
 * llaves primarias.
 */
export interface AuthUser {
  uuid: string;
  fullName: string;
  email: string;
  roleName: RoleName;
  mustChangePassword: boolean;
  passwordExpired?: boolean;
  passwordExpiresAt?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  sessionTimeoutMinutes: number;
}

export interface VerifyResponse {
  isAuthenticated: boolean;
  sessionTimeoutMinutes: number;
  user: AuthUser;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  newPassword_confirmation: string;
}

export interface RegisterUserRequest {
  fullName: string;
  email: string;
  /** Si se omite, el backend da de alta con rol USER. */
  roleName?: RoleName;
  password?: string;
}

export interface RegisteredUser {
  uuid: string;
  fullName: string;
  email: string;
  roleName: RoleName;
  passwordGenerated: boolean;
}

/** Requisitos vigentes de contraseña, configurables por el administrador. */
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  allowedSpecialChars: string;
  expirationDays: number;
}
