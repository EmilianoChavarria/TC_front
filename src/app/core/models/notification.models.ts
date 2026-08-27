import { Paginated } from './api.models';

/** Estado de un destinatario, tal como lo devuelve el backend. */
export type RecipientStatus = 'active' | 'paused' | 'deleted';

/**
 * Buzón que recibe el aviso del tipo de cambio.
 *
 * No es un usuario del portal: son direcciones de terceros —contabilidad, un
 * corporativo, una lista de distribución— que necesitan el dato del día sin
 * tener cuenta.
 */
export interface NotificationRecipient {
  uuid: string;
  email: string;
  name: string | null;
  isActive: boolean;
  isDeleted: boolean;
  status: RecipientStatus;
  statusLabel: string;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

/**
 * Página de destinatarios.
 *
 * `notifiable` es de TODA la lista, no de la página: es la cifra de cuántos
 * recibirán el próximo aviso, y contarla sobre las filas en pantalla daría un
 * número distinto en cada página.
 */
export interface NotificationRecipientsPage extends Paginated<NotificationRecipient> {
  notifiable: number;
}

export interface RecipientFilters {
  includeDeleted?: boolean;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface StoreRecipientRequest {
  email: string;
  name?: string | null;
  isActive?: boolean;
}

export type UpdateRecipientRequest = Partial<StoreRecipientRequest>;

/**
 * Resultado del alta masiva.
 *
 * No es «todo bien» o «error»: pegar una lista real deja los tres grupos a la
 * vez, y el usuario necesita ver qué pasó con cada uno.
 */
export interface BulkRecipientsResult {
  created: NotificationRecipient[];
  duplicates: string[];
  invalid: string[];
  /** Primera página ya con el alta dentro, para refrescar sin otra petición. */
  recipients: NotificationRecipientsPage;
}
