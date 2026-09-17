import { IDatabase } from '../types';

export class MessageRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  /** Idempotent on whatsapp_message_id — safe to call on webhook retries. */
  public async logInbound(customerId: number, whatsappMessageId: string, text: string): Promise<void> {
    await this.db.query(
      `INSERT INTO message (customer_id, whatsapp_message_id, message_type, message_text, direction)
       VALUES ($1, $2, 'text', $3, 'inbound')
       ON CONFLICT (whatsapp_message_id) DO NOTHING`,
      [customerId, whatsappMessageId, text],
    );
  }
}
