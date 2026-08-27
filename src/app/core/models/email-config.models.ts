/**
 * Modo de envío del correo saliente, tal como lo interpreta el backend
 * (`EmailSenderService`).
 *
 * - `normal`: cada correo va a su destinatario real.
 * - `override`: todo se redirige a una sola dirección, con el aviso de a quién
 *   le hubiera llegado. Es lo que se usa en pruebas para no escribirle a la
 *   gente de verdad.
 * - `disabled`: no sale nada; el intento queda en el log.
 */
export type EmailMode = 'normal' | 'override' | 'disabled';

/** Configuración de correo del portal. */
export interface EmailConfig {
  emailSupport: string | null;
  emailMode: EmailMode;
  overrideEmail: string | null;
  mailer: string;
  fromAddress: string;
  fromName: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpdateEmailConfigRequest {
  emailSupport: string;
  emailMode: EmailMode;
  /** Obligatorio cuando el modo es `override`; el backend lo valida. */
  overrideEmail?: string | null;
}
