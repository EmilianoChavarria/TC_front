import { RoleName } from './auth.models';

export type UserStatus = 'active' | 'inactive' | 'blocked';

/** Fila de la tabla de usuarios. */
export interface ManagedUser {
  uuid: string;
  fullName: string;
  email: string;
  roleName: RoleName;
  isActive: boolean;
  isDeleted: boolean;
  isBlocked: boolean;
  status: UserStatus;
  statusLabel: string;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface UserFilters {
  search?: string;
  roleName?: RoleName | '';
  status?: UserStatus | 'all';
  page?: number;
  perPage?: number;
}

export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  roleName?: RoleName;
  isActive?: boolean;
}

export interface RoleOption {
  roleName: RoleName;
  description: string | null;
  /** Roles de los que sólo puede existir una cuenta activa. */
  singleAccount: boolean;
}
