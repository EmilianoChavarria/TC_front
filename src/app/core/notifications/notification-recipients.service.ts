import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../http/api.client';
import {
  BulkRecipientsResult,
  NotificationRecipient,
  RecipientFilters,
  NotificationRecipientsPage,
  StoreRecipientRequest,
  UpdateRecipientRequest,
} from '../models/notification.models';

@Injectable({ providedIn: 'root' })
export class NotificationRecipientsService {
  private readonly api = inject(ApiClient);

  list(filters: RecipientFilters = {}): Observable<NotificationRecipientsPage> {
    return this.api.get<NotificationRecipientsPage>('notification-recipients', {
      includeDeleted: filters.includeDeleted ? 1 : 0,
      search: filters.search || null,
      page: filters.page ?? 1,
      perPage: filters.perPage ?? 10,
    });
  }

  create(payload: StoreRecipientRequest): Observable<NotificationRecipient> {
    return this.api.post<NotificationRecipient>('notification-recipients', payload);
  }

  /**
   * Alta de una lista pegada de golpe.
   *
   * Una sola petición y no una por correo: con veinte direcciones, veinte
   * peticiones dejan la pantalla a medias si una falla y no hay forma de
   * decir qué se guardó.
   */
  createMany(emails: string[], perPage = 10): Observable<BulkRecipientsResult> {
    // `perPage` viaja para que la página que devuelve el alta venga del mismo
    // tamaño que la que se está viendo.
    return this.api.post<BulkRecipientsResult>('notification-recipients/bulk', { emails, perPage });
  }

  update(uuid: string, payload: UpdateRecipientRequest): Observable<NotificationRecipient> {
    return this.api.put<NotificationRecipient>(`notification-recipients/${uuid}`, payload);
  }

  /** Baja lógica: la dirección puede volver a darse de alta después. */
  delete(uuid: string): Observable<NotificationRecipient> {
    return this.api.delete<NotificationRecipient>(`notification-recipients/${uuid}`);
  }

  restore(uuid: string): Observable<NotificationRecipient> {
    return this.api.post<NotificationRecipient>(`notification-recipients/${uuid}/restore`);
  }
}
