export interface NotificationMessage {
  title: string;
  body: string;
  recipientUserId?: string | null;
  recipientCustomerId?: string | null;
  data?: Record<string, string>;
}

export interface DeliveryResult {
  delivered: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface NotificationProvider {
  readonly channel: 'in_app' | 'push' | 'email' | 'sms' | 'whatsapp';
  send(message: NotificationMessage): Promise<DeliveryResult>;
}

/**
 * Placeholder until the client picks providers (FCM / SMS gateway / WhatsApp BSP).
 * DECISION_PENDING — no paid service is wired up yet.
 */
export class NoopProvider implements NotificationProvider {
  constructor(readonly channel: NotificationProvider['channel']) {}
  async send(): Promise<DeliveryResult> {
    return { delivered: false, error: 'PROVIDER_NOT_CONFIGURED' };
  }
}
