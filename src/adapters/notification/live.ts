import type { NotificationAdapter, NotificationEvent, NotificationResult } from '../types';
import { AdapterNotImplementedError } from '../errors';

/**
 * Notificações (live). Provedor a definir (Resend/SendGrid/SMTP corporativo).
 * Roda no SERVIDOR com NOTIFICATION_PROVIDER_API_KEY como secret. O corpo do
 * e-mail mantém o mínimo de dados; o link de assinatura segue as regras de
 * token (8.2) e é o único dado sensível permitido.
 */
export class LiveNotificationAdapter implements NotificationAdapter {
  async notificar(_event: NotificationEvent): Promise<NotificationResult> {
    // TODO(live): enviar via provedor de e-mail, retornando o messageId real.
    throw new AdapterNotImplementedError('LiveNotificationAdapter');
  }
}
