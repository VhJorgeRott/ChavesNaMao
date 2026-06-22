import type { NotificationAdapter, NotificationEvent, NotificationResult } from '../types';

/**
 * Notificações (mock): não envia e-mail real; registra de forma segura no console.
 * NUNCA loga dados pessoais ou o token em claro — apenas o tipo de evento e a
 * entrega. O link de assinatura (único dado sensível) jamais é logado.
 */
export class MockNotificationAdapter implements NotificationAdapter {
  async notificar(event: NotificationEvent): Promise<NotificationResult> {
    // Log seguro: sem destinatário completo, sem link, sem token.
    console.info(`[notificação:mock] ${event.tipo} para entrega ${event.entregaId}`);
    return {
      enviado: true,
      provider: 'mock',
      messageId: `mock-${Date.now().toString(36)}`,
    };
  }
}
