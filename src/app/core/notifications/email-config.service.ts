import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../http/api.client';
import { EmailConfig, UpdateEmailConfigRequest } from '../models/email-config.models';

@Injectable({ providedIn: 'root' })
export class EmailConfigService {
  private readonly api = inject(ApiClient);

  show(): Observable<EmailConfig> {
    return this.api.get<EmailConfig>('email-config');
  }

  update(payload: UpdateEmailConfigRequest): Observable<EmailConfig> {
    return this.api.put<EmailConfig>('email-config', payload);
  }
}
